"""
UML diagram planners (LLM) and generators (plan -> nodes/edges) for all diagram types.
"""
import json
import logging
import re
from typing import Any

from diagram_validator import validate_and_repair, get_valid_plan
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("architectai.uml")


def _format_code_for_mermaid(code: str | None, level: str = "small") -> str:
    """Format code for Mermaid node labels. NO HTML entities - they show as literal in SVG."""
    if not code or not isinstance(code, str):
        return ""
    text = code.strip()
    if not text:
        return ""
    if level == "small":
        lines = text.split("\n")[:3]
        text = "\n".join(lines)
        if len(text) > 150:
            text = text[:147] + "..."
    else:
        lines = text.split("\n")[:15]
        text = "\n".join(lines)
        if len(text) > 500:
            text = text[:497] + "..."
    text = text.replace("&", " and ").replace('"', "'")
    text = text.replace("[", "(").replace("]", ")")
    text = text.replace("{", "(").replace("}", ")")  # { } are DIAMOND in Mermaid; break labels
    text = re.sub(r"-{2,}", "-", text)  # --- is SUBROUTINEEND
    text = text.replace("\n", "<br/>")
    return text

# --- Class diagram ---
CLASS_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a CLASS DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "classes": [
    { "name": "ClassName", "attributes": ["attr: Type"], "methods": ["method(args): ReturnType"], "code": "optional 2-10 line snippet if user asks for code" }
  ],
  "relationships": [
    { "from": "ClassNameA", "to": "ClassNameB", "type": "extends" | "implements" | "associates" | "uses", "label": "optional short label" }
  ]
}
Rules: Keep 3-8 classes. "from" and "to" MUST be exact class names from the classes list. Keep names and labels SHORT. Use standard UML relationship types only.
Optional: Add "code" to a class when the user asks for implementation or code snippets."""

# --- Sequence diagram ---
SEQUENCE_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a SEQUENCE DIAGRAM (time-ordered interactions).

Return ONLY valid JSON with this exact structure:
{
  "participants": [ { "id": "U", "name": "User" }, { "id": "A", "name": "API" } ],
  "messages": [
    { "from": "U", "to": "A", "label": "short verb phrase", "order": 1 },
    { "from": "A", "to": "U", "label": "short response", "order": 2 }
  ]
}
Rules (strict):
- NUMBERING is mandatory: every message MUST have "order": 1, 2, 3, ... in strict time order. Step 1 = first, 2 = second, etc. No gaps, no duplicates.
- Messages MUST be listed in chronological order (order 1, then 2, then 3...). Vertical position in the diagram = time.
- Use 2-6 participants. Use short ids (e.g. U, A, G, K) in from/to. from and to must be participant ids.
- Keep each message label SHORT (2-5 words). To the point only.
- Flow: request → process → response. Include return messages where relevant."""

# --- Use case diagram ---
USECASE_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a COMPLETE USE CASE DIAGRAM.

CRITICAL: Include EVERY actor, use case, and relationship the user specifies. Do NOT summarize, simplify, or reduce the list. If the user lists 5 actors and 25 use cases, your JSON must contain all 5 actors and all 25 use cases (with short but clear names). Missing items makes the diagram useless.

Return ONLY valid JSON with this exact structure:
{
  "actors": [ { "id": "a1", "name": "Actor Name" }, ... ],
  "useCases": [ { "id": "uc1", "name": "Use Case Name" }, ... ],
  "links": [ { "actorId": "a1", "useCaseId": "uc1", "order": 1 }, ... ],
  "includes": [ { "from": "ucSendMessage", "to": "ucEncryptMessage" }, ... ],
  "extends": [ { "from": "ucReceiveMessage", "to": "ucSendNotification" }, ... ],
  "systemBoundary": "System Name"
}

Rules:
- actors: Include every actor the user mentions (e.g. User, Contact, Server, External Service). Use ids like a1, a2, user, contact, server. Up to 15 actors.
- useCases: Include every use case the user lists (primary, secondary, system). Use ids like uc1, uc2, or short names: ucLogin, ucSendMsg. Up to 50 use cases. Keep "name" readable (2-6 words).
- links: Every actor–use case association the user describes. actorId and useCaseId MUST be existing ids. "order": 1, 2, 3... for display order.
- includes: When the user says "A includes B", add { "from": "idOfA", "to": "idOfB" }. Both must be use case ids.
- extends: When the user says "A extends B", add { "from": "idOfA", "to": "idOfB" }. Both must be use case ids.
- systemBoundary: If the user asks for a system boundary (e.g. "WhatsApp System"), set this to that label; otherwise omit or null.
- All ids in links, includes, and extends MUST reference existing actors or use cases from the arrays above.

IMPORTANT: Count the actors and use cases in the user's message. Your JSON must contain at least that many. Outputting only 2-3 use cases when the user listed 20+ is wrong. Prefer a complete diagram over a short one."""

# --- Activity diagram ---
ACTIVITY_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract an ACTIVITY DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    { "id": "n1", "type": "start" | "activity" | "decision" | "end", "label": "Short label", "code": "optional 2-10 line snippet if user asks for code" }
  ],
  "edges": [ { "from": "n1", "to": "n2", "label": "short", "order": 1 } ]
}
Rules: Exactly one start and one end. "from" and "to" MUST be node ids. Edges MUST have "order": 1, 2, 3... in flow order. Keep all labels SHORT (2-5 words). Use 4-12 nodes.
Optional: Add "code" to a node when the user asks for code or implementation details."""

# --- Flowchart diagram ---
FLOWCHART_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a FLOWCHART.
Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    { "id": "n1", "type": "start" | "process" | "decision" | "end", "label": "Short label", "code": "optional 2-10 line snippet if user asks for code" }
  ],
  "edges": [ { "from": "n1", "to": "n2", "label": "yes/no/ok", "order": 1 } ]
}
Rules:
- "type": "start" (rounded), "process" (box), "decision" (diamond), "end" (rounded).
- "from" and "to" MUST be node ids.
- Edges MUST have "order": 1, 2, 3... in flow order.
- Keep labels SHORT. Optional: Add "code" to a node when the user asks for code snippets."""

# --- State diagram ---
STATE_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a STATE DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "states": [ { "id": "s1", "name": "State Name", "isInitial": false, "isFinal": false, "code": "optional 2-10 line snippet if user asks for code" } ],
  "transitions": [ { "from": "s1", "to": "s2", "label": "event / action", "order": 1 } ]
}
Rules: Exactly one state with isInitial: true. Optionally one isFinal: true. "from" and "to" MUST be state ids. Transitions MUST have "order": 1, 2, 3... for display. Keep labels SHORT.
Optional: Add "code" to a state when the user asks for code or implementation details."""

# --- Component diagram ---
COMPONENT_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a COMPONENT DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "components": [ { "id": "c1", "name": "Component Name", "code": "optional 2-10 line snippet if user asks for code" } ],
  "dependencies": [ { "from": "c1", "to": "c2", "label": "optional short label", "order": 1 } ]
}
Rules: 3-8 components. "from" and "to" MUST be component ids. Add "order": 1, 2, 3... to dependencies for display. Keep names and labels SHORT.
Optional: Add "code" to a component when the user asks for code or implementation details."""

# --- Deployment diagram ---
DEPLOYMENT_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a SIMPLE deployment diagram that is easy to understand.

Return ONLY valid JSON with this exact structure:
{
  "explanation": "2-3 short sentences: what triggers the flow, main steps, and outcome. Simple language.",
  "nodes": [
    { "id": "n1", "name": "Short Name", "type": "device" | "executionEnv", "description": "One short line" }
  ],
  "artifacts": [
    { "id": "a1", "name": "Artifact", "nodeId": "n1", "description": "One short line" }
  ],
  "connections": [
    { "from": "n1", "to": "n2", "label": "what happens", "order": 1 }
  ]
}
Rules (strict):
- NUMBERING: connections MUST have "order": 1, 2, 3... in the order things happen. No gaps.
- Use at most 5 nodes and 2 artifacts. Fewer is better.
- Keep names and labels SHORT (2-4 words). To the point only.
- Every connection needs a label and order. "from" and "to" must be node ids."""


# --- Mindtree diagram ---
MINDTREE_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a MIND MAP (Mindtree).
Return ONLY valid JSON with this exact structure:
{
  "rootId": "root",
  "nodes": [
    { "id": "root", "label": "Central Topic", "parentId": "" },
    { "id": "c1", "label": "Branch 1", "parentId": "root" }
  ]
}
Rules:
- "rootId" must match one node's "id". That node has "parentId": "".
- All other nodes must have a valid "parentId".
- "id" must be alphanumeric (keep it short).
- "label" should be short (1-5 words).
- Create a balanced tree with 2-4 levels depth."""


def _extract_json(text: str) -> str:
    """Strip markdown code fences and extract JSON blob."""
    text = (text or "").strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    text = text.strip()
    # If response has leading/trailing prose, find first { and last }
    start = text.find("{")
    if start != -1:
        depth = 0
        end = -1
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end != -1:
            text = text[start : end + 1]
    return text


def _repair_json(s: str) -> str:
    """Apply common fixes for LLM-generated JSON."""
    # Remove trailing commas before } or ]
    s = re.sub(r",\s*([}\]])", r"\1", s)
    # Add missing comma between } and { (e.g. "classes": [ {...} {...} ])
    s = re.sub(r"\}\s*\{", "}, {", s)
    return s


def _safe_id(raw: Any, max_len: int = 20) -> str:
    """Mermaid-safe node id: alphanumeric and underscore only."""
    s = (str(raw) if raw is not None else "").strip().replace("-", "_")
    out = "".join(c if c.isalnum() or c == "_" else "_" for c in s)[:max_len]
    return out or "n"


def _parse_json(raw: str) -> dict:
    """Parse JSON with extraction and repair fallback."""
    text = _extract_json(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    repaired = _repair_json(text)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        raise


def _invoke_llm(system_prompt: str, user_prompt: str, llm) -> dict:
    from langchain_core.messages import HumanMessage, SystemMessage
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    response = llm.invoke(messages)
    raw = getattr(response, "content", "") or ""
    return _parse_json(raw)


def _uml_fix_hint(diagram_type: str) -> str:
    """Hint for LLM when fixing invalid UML JSON."""
    hints = {
        "class": "Keep 'classes' (name, attributes, methods) and 'relationships' (from, to, type). from/to must be class names.",
        "sequence": "Keep 'participants' (id, name) and 'messages' (from, to, label, order). from/to must be participant ids.",
        "usecase": "Keep 'actors', 'useCases', 'links' (actorId, useCaseId, order). Optional: 'includes' and 'extends' arrays with from/to use case ids, 'systemBoundary' string. Ids must match.",
        "activity": "Keep 'nodes' (id, type: start|activity|decision|end) and 'edges' (from, to, label, order). Exactly one start, one end.",
        "state": "Keep 'states' (id, name, isInitial, isFinal) and 'transitions' (from, to, label, order). One isInitial.",
        "component": "Keep 'components' (id, name) and 'dependencies' (from, to, label, order).",
        "deployment": "Keep 'nodes' (id, name, type: device|executionEnv), 'artifacts' (id, name, nodeId), 'connections' (from, to, label, order).",
        "mindtree": "Keep 'rootId' and 'nodes' (id, label, parentId). Ensure root exists and parentIds are valid.",
    }
    return hints.get(diagram_type, "Output only valid JSON matching the required structure.")


def plan_uml(diagram_type: str, prompt: str, llm) -> dict:
    """Return a validated plan dict for the given UML diagram type (LLM)."""
    prompts = {
        "class": CLASS_SYSTEM_PROMPT,
        "sequence": SEQUENCE_SYSTEM_PROMPT,
        "usecase": USECASE_SYSTEM_PROMPT,
        "activity": ACTIVITY_SYSTEM_PROMPT,
        "flowchart": FLOWCHART_SYSTEM_PROMPT,
        "state": STATE_SYSTEM_PROMPT,
        "component": COMPONENT_SYSTEM_PROMPT,
        "deployment": DEPLOYMENT_SYSTEM_PROMPT,
        "mindtree": MINDTREE_SYSTEM_PROMPT,
    }
    sys_prompt = prompts.get(diagram_type)
    if not sys_prompt or not llm:
        return _mock_plan_uml(diagram_type, prompt)
    try:
        plan = _invoke_llm(sys_prompt, prompt, llm)
        result = validate_and_repair(diagram_type, plan)
        if result.is_valid:
            logger.info("UML plan validation passed", extra={"diagram_type": diagram_type})
            return plan
        # One retry with fix prompt
        if result.errors:
            try:
                fix_prompt = f"""The JSON failed validation. Return ONLY the corrected JSON.

Errors:
{chr(10).join('- ' + e for e in result.errors[:8])}

Current JSON:
{json.dumps(plan, indent=2)[:1800]}

Original request: {prompt[:200]}

{_uml_fix_hint(diagram_type)}"""
                messages = [
                    SystemMessage(content="Output ONLY valid JSON. No markdown, no explanation."),
                    HumanMessage(content=fix_prompt),
                ]
                response = llm.invoke(messages)
                raw = getattr(response, "content", "") or ""
                retry_plan = _parse_json(raw)
                retry_result = validate_and_repair(diagram_type, retry_plan)
                if retry_result.is_valid:
                    logger.info("UML plan validation passed after retry", extra={"diagram_type": diagram_type})
                    return retry_plan
            except Exception as e:
                logger.warning("UML validation retry failed: %s", e, extra={"diagram_type": diagram_type})
        return get_valid_plan(diagram_type, plan)
    except Exception as e:
        logger.exception("UML plan error: %s", e)
        return _mock_plan_uml(diagram_type, prompt)


def _mock_plan_uml(diagram_type: str, prompt: str) -> dict:
    """Fallback plans when LLM fails or mock mode."""
    p = prompt.lower()
    if diagram_type == "class":
        return {
            "classes": [
                {"name": "User", "attributes": ["id: int", "name: string"], "methods": ["login()", "logout()"]},
                {"name": "Service", "attributes": ["config: Config"], "methods": ["handleRequest()"]},
            ],
            "relationships": [{"from": "User", "to": "Service", "type": "uses", "label": ""}],
        }
    if diagram_type == "sequence":
        return {
            "participants": [{"id": "U", "name": "User"}, {"id": "A", "name": "API"}],
            "messages": [
                {"from": "U", "to": "A", "label": "sends request", "order": 1},
                {"from": "A", "to": "U", "label": "returns response", "order": 2},
            ],
        }
    if diagram_type == "usecase":
        return {
            "actors": [{"id": "a1", "name": "User"}, {"id": "a2", "name": "Contact"}],
            "useCases": [
                {"id": "uc1", "name": "Login"},
                {"id": "uc2", "name": "Send Message"},
                {"id": "uc3", "name": "Receive Message"},
                {"id": "uc4", "name": "Logout"},
            ],
            "links": [
                {"actorId": "a1", "useCaseId": "uc1", "order": 1},
                {"actorId": "a1", "useCaseId": "uc2", "order": 2},
                {"actorId": "a2", "useCaseId": "uc3", "order": 3},
                {"actorId": "a1", "useCaseId": "uc4", "order": 4},
            ],
            "includes": [],
            "extends": [],
        }
    if diagram_type == "activity":
        return {
            "nodes": [
                {"id": "start", "type": "start", "label": "Start"},
                {"id": "a1", "type": "activity", "label": "Do work"},
                {"id": "end", "type": "end", "label": "End"},
            ],
            "edges": [{"from": "start", "to": "a1", "label": "begin", "order": 1}, {"from": "a1", "to": "end", "label": "done", "order": 2}],
        }
    if diagram_type == "flowchart":
        return {
            "nodes": [
                {"id": "start", "type": "start", "label": "Start"},
                {"id": "p1", "type": "process", "label": "Process"},
                {"id": "d1", "type": "decision", "label": "Is Valid?"},
                {"id": "end", "type": "end", "label": "End"},
            ],
            "edges": [
                {"from": "start", "to": "p1", "label": "", "order": 1},
                {"from": "p1", "to": "d1", "label": "", "order": 2},
                {"from": "d1", "to": "end", "label": "yes", "order": 3},
            ],
        }
    if diagram_type == "state":
        return {
            "states": [
                {"id": "s1", "name": "Idle", "isInitial": True, "isFinal": False},
                {"id": "s2", "name": "Active", "isInitial": False, "isFinal": False},
            ],
            "transitions": [{"from": "s1", "to": "s2", "label": "start", "order": 1}],
        }
    if diagram_type == "component":
        return {
            "components": [{"id": "c1", "name": "API"}, {"id": "c2", "name": "DB"}],
            "dependencies": [{"from": "c1", "to": "c2", "label": "uses", "order": 1}],
        }
    if diagram_type == "deployment":
        return {
            "explanation": "The client sends requests to the server. The app runs on the server.",
            "nodes": [
                {"id": "n1", "name": "Client", "type": "device", "description": "Sends requests"},
                {"id": "n2", "name": "Server", "type": "executionEnv", "description": "Hosts the app"},
            ],
            "artifacts": [{"id": "a1", "name": "App", "nodeId": "n2", "description": "Deployed app"}],
            "connections": [
                {"from": "n1", "to": "n2", "label": "sends requests to", "order": 1},
            ],
        }
    if diagram_type == "mindtree":
        return {
            "rootId": "root",
            "nodes": [
                {"id": "root", "label": "System", "parentId": ""},
                {"id": "n1", "label": "Frontend", "parentId": "root"},
                {"id": "n2", "label": "Backend", "parentId": "root"},
                {"id": "n3", "label": "Database", "parentId": "n2"},
            ],
        }
    return {}


def generate_uml(diagram_type: str, plan: dict) -> dict:
    """Convert UML plan to { nodes, edges } for React Flow."""
    gen = {
        "class": _gen_class,
        "sequence": _gen_sequence,
        "usecase": _gen_usecase,
        "activity": _gen_activity,
        "flowchart": _gen_activity,
        "state": _gen_state,
        "component": _gen_component,
        "deployment": _gen_deployment,
    }
    fn = gen.get(diagram_type)
    if not fn:
        return {"nodes": [], "edges": []}
    return fn(plan)


def plan_to_mermaid(diagram_type: str, plan: dict, code_detail_level: str = "small") -> str | None:
    """
    Produce Mermaid diagram code from the same plan used for nodes/edges.
    Returns None for types we don't map to Mermaid. Keeps rendering abstract (caller chooses flow vs mermaid).
    """
    if diagram_type == "sequence":
        participants = plan.get("participants", [])
        messages = sorted(plan.get("messages", []), key=lambda m: m.get("order", 0))
        if not participants or not messages:
            return None
        lines = ["sequenceDiagram"]
        for p in participants:
            pid = (p.get("id") or p.get("name") or "").replace('"', "'")[:20]
            name = (p.get("name") or p.get("id") or "?").replace('"', "'")[:40]
            lines.append(f'    participant {pid} as "{name}"')
        for m in messages:
            src = (m.get("from") or "A").replace("->", "-")
            tgt = (m.get("to") or "B").replace("->", "-")
            label = (m.get("label") or "").replace('"', "'").replace("\n", " ")[:60]
            lines.append(f'    {src}->>{tgt}: "{label}"')
        return "\n".join(lines)

    if diagram_type == "flowchart":
        uml_nodes = plan.get("nodes", [])
        raw_edges = plan.get("edges", [])
        edges_sorted = sorted(raw_edges, key=lambda e: int(e.get("order", 0)))
        if not uml_nodes:
            return None
        # Map plan node id -> safe Mermaid id
        id_map: dict[str, str] = {}
        for i, n in enumerate(uml_nodes):
            raw_id = n.get("id") or f"n{i}"
            safe = "".join(c if c.isalnum() else "_" for c in raw_id)[:25] or f"n{i}"
            id_map[raw_id] = safe
        lines = ["flowchart TD"]
        for n in uml_nodes:
            nid = id_map.get(n.get("id", ""), "n0")
            label = (n.get("label") or nid).replace("]", " ").replace("[", " ").replace("(", " ").replace(")", " ").replace('"', "'")[:40]
            code_block = n.get("code") or n.get("snippet")
            if code_block:
                code_fmt = _format_code_for_mermaid(code_block, code_detail_level)
                if code_fmt:
                    label = f"{label}<br/>{code_fmt}"
            t = (n.get("type") or "process").lower()
            if t == "start":
                lines.append(f'    {nid}(["{label}"])')
            elif t == "end":
                lines.append(f'    {nid}(["{label}"])')
            elif t == "decision":
                lines.append(f'    {nid}{{"{label}"}}')
            else:
                lines.append(f'    {nid}["{label}"]')
        for e in edges_sorted:
            fr = id_map.get(e.get("from", ""), (e.get("from") or "n0").replace("-", "_")[:25])
            to = id_map.get(e.get("to", ""), (e.get("to") or "n0").replace("-", "_")[:25])
            lbl = (e.get("label") or "").strip()
            if lbl:
                lines.append(f'    {fr} -->|"{lbl}"| {to}')
            else:
                lines.append(f"    {fr} --> {to}")
        return "\n".join(lines)

    if diagram_type == "activity":
        uml_nodes = plan.get("nodes", [])
        raw_edges = plan.get("edges", [])
        edges_sorted = sorted(raw_edges, key=lambda e: int(e.get("order", 0)))
        if not uml_nodes:
            return None
        # Map plan node id -> safe Mermaid id
        id_map: dict[str, str] = {}
        for i, n in enumerate(uml_nodes):
            raw_id = n.get("id") or f"n{i}"
            safe = "".join(c if c.isalnum() else "_" for c in raw_id)[:25] or f"n{i}"
            id_map[raw_id] = safe
        lines = ["flowchart TD"]
        for n in uml_nodes:
            nid = id_map.get(n.get("id", ""), "n0")
            label = (n.get("label") or nid).replace("]", " ").replace("[", " ").replace("(", " ").replace(")", " ").replace('"', "'")[:40]
            code_block = n.get("code") or n.get("snippet")
            if code_block:
                code_fmt = _format_code_for_mermaid(code_block, code_detail_level)
                if code_fmt:
                    label = f"{label}<br/>{code_fmt}"
            t = (n.get("type") or "activity").lower()
            if t == "start":
                lines.append(f'    {nid}(["{label}"])')
            elif t == "end":
                lines.append(f'    {nid}(["{label}"])')
            elif t == "decision":
                lines.append(f'    {nid}{{"{label}"}}')
            else:
                lines.append(f'    {nid}["{label}"]')
        for e in edges_sorted:
            fr = id_map.get(e.get("from", ""), (e.get("from") or "n0").replace("-", "_")[:25])
            to = id_map.get(e.get("to", ""), (e.get("to") or "n0").replace("-", "_")[:25])
            lines.append(f"    {fr} --> {to}")
        return "\n".join(lines)

    if diagram_type == "class":
        classes = plan.get("classes", [])
        relationships = plan.get("relationships", [])
        if not classes:
            return None
        lines = ["classDiagram"]
        for c in classes:
            name = (c.get("name") or "Class").replace('"', "'")
            lines.append(f'    class {name} {{')
            for attr in (c.get("attributes") or [])[:5]:
                a = str(attr).replace('"', "'").replace("{", " ").replace("}", " ")[:50]
                lines.append(f"        +{a}")
            for method in (c.get("methods") or [])[:5]:
                m = str(method).replace('"', "'").replace("{", " ").replace("}", " ")[:50]
                lines.append(f"        +{m}")
            # Class diagram notes not supported in Mermaid; code available in plan for React Flow / popover
            lines.append("    }")
        name_to_id = {c.get("name", ""): (c.get("name") or "").replace(" ", "_") for c in classes}
        for rel in relationships:
            src = name_to_id.get(rel.get("from"), (rel.get("from") or "A").replace(" ", "_"))
            tgt = name_to_id.get(rel.get("to"), (rel.get("to") or "B").replace(" ", "_"))
            rtype = (rel.get("type") or "association").replace(" ", "_")
            if rtype == "extends":
                lines.append(f"    {src} --|> {tgt}")
            elif rtype == "implements":
                lines.append(f"    {src} ..|> {tgt}")
            else:
                lines.append(f"    {src} -- {tgt}")
        return "\n".join(lines)

    if diagram_type == "state":
        states = plan.get("states", [])
        transitions = sorted(plan.get("transitions", []), key=lambda t: int(t.get("order", 0)))
        if not states:
            return None
        lines = ["stateDiagram-v2"]
        for s in states:
            name = (s.get("name") or s.get("id") or "?").replace('"', "'").replace(":", " ")[:40]
            code_block = s.get("code") or s.get("snippet")
            if code_block:
                code_fmt = _format_code_for_mermaid(code_block, code_detail_level)
                if code_fmt:
                    name = f"{name}<br/>{code_fmt}"
            sid = (s.get("id") or "s").replace("-", "_")[:30]
            if s.get("isInitial"):
                lines.append(f"    [*] --> {sid}")
            lines.append(f"    {sid} : {name}")
            if s.get("isFinal"):
                lines.append(f"    {sid} --> [*]")
        for t in transitions:
            fr = (t.get("from") or "s1").replace("-", "_")[:30]
            to = (t.get("to") or "s2").replace("-", "_")[:30]
            label = (t.get("label") or "").replace('"', "'").replace(":", " ")[:30]
            if label:
                lines.append(f"    {fr} --> {to} : {label}")
            else:
                lines.append(f"    {fr} --> {to}")
        return "\n".join(lines)

    if diagram_type == "usecase":
        actors = plan.get("actors", [])
        use_cases = plan.get("useCases", [])
        links = sorted(plan.get("links", []), key=lambda l: int(l.get("order", 0)))
        includes = plan.get("includes", [])
        extends = plan.get("extends", [])
        system_boundary = (plan.get("systemBoundary") or "").strip()
        # uc_id -> first actor id (by actor order) that links to it (for column grouping)
        uc_to_actor: dict[str, str] = {}
        actor_ids_ordered = [(a.get("id") or f"a{i}").strip() for i, a in enumerate(actors)]
        link_pairs = [((link.get("actorId") or "").strip(), (link.get("useCaseId") or "").strip()) for link in links]
        for aid in actor_ids_ordered:
            for a, ucid in link_pairs:
                if a == aid and ucid and ucid not in uc_to_actor:
                    uc_to_actor[ucid] = aid
        lines = ["flowchart TB"]
        # Miro-style: one subgraph per actor column, use cases inside
        for i, a in enumerate(actors):
            aid = _safe_id(a.get("id") or "a", 20)
            name = (a.get("name") or aid).replace('"', "'")[:30]
            lines.append(f'    subgraph col_{i}["👤 {name}"]')
            lines.append(f'        {aid}[/"{name}"/]')
            a_id_strip = (a.get("id") or "").strip()
            for uc in use_cases:
                ucid = (uc.get("id") or "").strip()
                if uc_to_actor.get(ucid) == a_id_strip:
                    m_ucid = _safe_id(ucid or "uc", 20)
                    uc_name = (uc.get("name") or ucid).replace('"', "'")[:40]
                    lines.append(f'        {m_ucid}(("{uc_name}"))')
            lines.append("    end")
        # Use cases not linked to any actor go in system boundary column
        unplaced_ucs = [uc for uc in use_cases if (uc.get("id") or "").strip() not in uc_to_actor]
        if unplaced_ucs:
            label = (system_boundary or "System").replace('"', "'")[:50]
            lines.append(f'    subgraph system["{label}"]')
            for uc in unplaced_ucs:
                ucid = _safe_id(uc.get("id") or "uc", 20)
                name = (uc.get("name") or ucid).replace('"', "'")[:40]
                lines.append(f'    {ucid}(("{name}"))')
            lines.append("    end")
        # Actor–use case links
        for link in links:
            aid = _safe_id(link.get("actorId") or "a", 20)
            ucid = _safe_id(link.get("useCaseId") or "uc", 20)
            lines.append(f"    {aid} --> {ucid}")
        # Includes / extends (use case to use case)
        for inc in includes:
            fr = _safe_id(inc.get("from") or "uc", 20)
            to = _safe_id(inc.get("to") or "uc", 20)
            lines.append(f'    {fr} -->|"<<include>>"| {to}')
        for ext in extends:
            fr = _safe_id(ext.get("from") or "uc", 20)
            to = _safe_id(ext.get("to") or "uc", 20)
            lines.append(f'    {fr} -->|"<<extend>>"| {to}')
        return "\n".join(lines)

    if diagram_type == "component":
        components = plan.get("components", [])
        deps = sorted(plan.get("dependencies", []), key=lambda d: int(d.get("order", 0)))
        if not components:
            return None
        lines = ["flowchart TB"]
        for c in components:
            cid = (c.get("id") or "c").replace("-", "_")[:20]
            name = (c.get("name") or cid).replace('"', "'")[:40]
            lines.append(f'    {cid}["📦 {name}"]')
        for i, d in enumerate(deps):
            fr = (d.get("from") or "c1").replace("-", "_")[:20]
            to = (d.get("to") or "c2").replace("-", "_")[:20]
            label = (d.get("label") or "").replace('"', "'")[:30]
            if label:
                lines.append(f'    {fr} -->|"{label}"| {to}')
            else:
                lines.append(f"    {fr} --> {to}")
        return "\n".join(lines)

    if diagram_type == "deployment":
        nodes = plan.get("nodes", [])
        artifacts = plan.get("artifacts", [])
        connections = sorted(plan.get("connections", []), key=lambda c: int(c.get("order", 0)))
        if not nodes:
            return None
        lines = ["flowchart LR"]
        for n in nodes:
            nid = (n.get("id") or "n").replace("-", "_")[:20]
            name = (n.get("name") or nid).replace('"', "'")[:35]
            ntype = (n.get("type") or "device").lower()
            icon = "🖥️" if ntype == "device" else "⚙️"
            desc = (n.get("description") or "").replace('"', "'")[:40]
            if desc:
                lines.append(f'    {nid}["{icon} {name}<br/><small>{desc}</small>"]')
            else:
                lines.append(f'    {nid}["{icon} {name}"]')
        # Artifacts as sub-items
        for a in artifacts:
            aid = (a.get("id") or "a").replace("-", "_")[:20]
            name = (a.get("name") or aid).replace('"', "'")[:30]
            node_id = (a.get("nodeId") or "").replace("-", "_")[:20]
            lines.append(f'    {aid}[/"📄 {name}"/]')
            if node_id:
                lines.append(f"    {node_id} -.-> {aid}")
        for c in connections:
            fr = (c.get("from") or "n1").replace("-", "_")[:20]
            to = (c.get("to") or "n2").replace("-", "_")[:20]
            label = (c.get("label") or "").replace('"', "'")[:30]
            if label:
                lines.append(f'    {fr} -->|"{label}"| {to}')
            else:
                lines.append(f"    {fr} --> {to}")
        return "\n".join(lines)

    if diagram_type == "mindtree":
        root_id = (plan.get("rootId") or "").strip()
        nodes = plan.get("nodes", [])
        if not root_id or not nodes:
            return None
            
        # Build adjacency list for tree traversal
        children = {}
        node_map = {}
        for n in nodes:
            nid = (n.get("id") or "").strip()
            if not nid: continue
            node_map[nid] = n
            pid = (n.get("parentId") or "").strip()
            if pid:
                children.setdefault(pid, []).append(nid)
        
        if root_id not in node_map:
            return None

        lines = ["mindmap", f"  root(({(node_map[root_id].get('label') or 'Root')[:40]}))"]
        
        def _dfs(pid, depth):
            if depth > 5: return
            indent = "  " * (depth + 1)
            for cid in children.get(pid, []):
                lbl = (node_map[cid].get("label") or cid)[:40].replace("(", "").replace(")", "")
                # Different shapes based on depth could be cool, but keep it simple
                lines.append(f"{indent}{lbl}")
                _dfs(cid, depth + 1)
        
        _dfs(root_id, 1)
        return "\n".join(lines)

    return None


def _layout(
    nodes: list,
    width: int = 320,
    row_height: int = 200,
    start_x: int = 100,
    start_y: int = 100,
    max_cols: int | None = None,
    horizontal_gap: int = 80,
) -> None:
    """Place nodes in a grid with generous spacing to avoid overlap; mutates nodes[].position."""
    import math
    n = len(nodes)
    if n == 0:
        return
    # Calculate optimal columns - prefer wider layouts for better visibility
    cols = max(1, min(4, int(math.ceil(math.sqrt(n * 1.5)))))
    if max_cols is not None:
        cols = min(cols, max_cols)
    
    # Effective spacing includes the gap
    effective_width = width + horizontal_gap
    
    for i, node in enumerate(nodes):
        row, col = divmod(i, cols)
        node["position"] = {"x": start_x + col * effective_width, "y": start_y + row * row_height}


def _layout_usecase_swimlane(
    actor_nodes: list,
    use_case_nodes: list,
    links: list,
    *,
    start_x: int = 80,
    start_y: int = 40,
    column_width: int = 200,
    actor_row_height: int = 72,
    use_case_row_height: int = 56,
) -> None:
    """
    Miro-style column layout: one column per actor, use cases stacked under their primary actor.
    Mutates position on actor_nodes and use_case_nodes.
    """
    if not actor_nodes:
        _layout(actor_nodes + use_case_nodes, width=200, row_height=80)
        return
    # uc_id -> list of actor ids that link to this use case (order from links)
    uc_to_actors: dict[str, list[str]] = {}
    for link in links:
        aid = (link.get("actorId") or "").strip()
        ucid = (link.get("useCaseId") or "").strip()
        if not aid or not ucid:
            continue
        if ucid not in uc_to_actors:
            uc_to_actors[ucid] = []
        if aid not in uc_to_actors[ucid]:
            uc_to_actors[ucid].append(aid)
    # Actor order (column index)
    actor_ids = [a.get("id", "") for a in actor_nodes]
    aid_to_col = {aid: i for i, aid in enumerate(actor_ids)}
    num_cols = len(actor_ids)
    # Assign each use case to column: first linked actor by column order; else last column (system)
    col_to_ucs: dict[int, list[dict]] = {i: [] for i in range(num_cols)}
    for uc_node in use_case_nodes:
        ucid = uc_node.get("id", "")
        linked = uc_to_actors.get(ucid, [])
        col = num_cols - 1
        for aid in actor_ids:
            if aid in linked:
                col = aid_to_col[aid]
                break
        col_to_ucs[col].append(uc_node)
    # Position actors in a row at top
    for i, node in enumerate(actor_nodes):
        node["position"] = {
            "x": start_x + i * column_width,
            "y": start_y,
        }
    # Position use cases under their column
    uc_start_y = start_y + actor_row_height
    for col in range(num_cols):
        for row, uc_node in enumerate(col_to_ucs[col]):
            uc_node["position"] = {
                "x": start_x + col * column_width,
                "y": uc_start_y + row * use_case_row_height,
            }


def _gen_class(plan: dict) -> dict:
    classes = plan.get("classes", [])
    relationships = plan.get("relationships", [])
    nodes = []
    edges = []
    for i, c in enumerate(classes):
        attrs = "\n".join(c.get("attributes", [])[:5])
        methods = "\n".join(c.get("methods", [])[:5])
        nodes.append({
            "id": f"class-{i}",
            "type": "class",
            "position": {"x": 0, "y": 0},
            "data": {"label": c.get("name", "Class"), "attributes": attrs, "methods": methods},
        })
    # Class diagram: generous spacing and max 2 columns for clear UML layout
    _layout(nodes, width=320, row_height=280, start_x=80, start_y=60, max_cols=2)
    name_to_id = {c.get("name", ""): f"class-{i}" for i, c in enumerate(classes)}
    for j, rel in enumerate(relationships):
        src = name_to_id.get(rel.get("from"), "")
        tgt = name_to_id.get(rel.get("to"), "")
        if src and tgt:
            edges.append({
                "id": f"edge-{j}",
                "source": src,
                "target": tgt,
                "label": rel.get("type", ""),
                "data": {"label": rel.get("label") or rel.get("type", "")},
            })
    return {"nodes": nodes, "edges": edges}


def _gen_sequence(plan: dict) -> dict:
    """
    UML sequence diagram: participants in a row, one message node per interaction
    at increasing Y (strict time order). Edges: participant -> message -> participant.
    Numbering: step 1, 2, 3... always in order. Message box centered between participants.
    """
    participants = plan.get("participants", [])
    raw_messages = plan.get("messages", [])
    # Normalize order: assign 1..n by index if missing; then sort by order
    messages_with_order = []
    for i, m in enumerate(raw_messages):
        order = m.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            m = {**m, "order": i + 1}
        messages_with_order.append(m)
    messages = sorted(messages_with_order, key=lambda m: int(m.get("order", 0)))
    nodes = []
    edges = []
    col_w = 280  # Increased column width for participants
    start_x, start_y = 100, 60
    msg_row_height = 90  # Increased row height for messages
    msg_box_width = 140  # Wider message boxes

    id_to_idx = {p.get("id", f"p{i}"): i for i, p in enumerate(participants)}

    # Participant nodes (lifelines) in a row at top
    for i, p in enumerate(participants):
        pid = p.get("id", f"p{i}")
        nodes.append({
            "id": pid,
            "type": "lifeline",
            "position": {"x": start_x + i * col_w, "y": start_y},
            "data": {"label": p.get("name", p.get("id", "Actor"))},
        })

    # One message node per step: strict order 1, 2, 3...; Y increases with time
    for j, msg in enumerate(messages):
        step_num = j + 1
        src_id = msg.get("from", "")
        tgt_id = msg.get("to", "")
        src_idx = id_to_idx.get(src_id, 0)
        tgt_idx = id_to_idx.get(tgt_id, 0)
        label = (msg.get("label") or "").strip()
        # Display: number prominent, label short
        step_label = f"{label}" if label else f"Step {step_num}"
        # Center message box between the two participants
        center_x = start_x + (src_idx + tgt_idx) * (col_w / 2)
        x_msg = center_x - msg_box_width / 2
        y_msg = start_y + 100 + j * msg_row_height

        msg_id = f"m{j}"
        nodes.append({
            "id": msg_id,
            "type": "sequenceMessage",
            "position": {"x": x_msg, "y": y_msg},
            "data": {"label": step_label, "step": step_num},
        })
        edges.append({
            "id": f"e-{j}-a",
            "source": src_id,
            "target": msg_id,
            "sourceHandle": "right",
            "targetHandle": "left",
            "markerEnd": "arrowclosed",
            "type": "straight",
        })
        edges.append({
            "id": f"e-{j}-b",
            "source": msg_id,
            "target": tgt_id,
            "sourceHandle": "right",
            "targetHandle": "left",
            "markerEnd": "arrowclosed",
            "type": "straight",
        })

    return {"nodes": nodes, "edges": edges}


def _gen_usecase(plan: dict) -> dict:
    actors = plan.get("actors", [])
    use_cases = plan.get("useCases", [])
    raw_links = plan.get("links", [])
    includes = plan.get("includes", [])
    extends = plan.get("extends", [])
    # Normalize order; sort by order for numbered display
    links_with_order = []
    for i, link in enumerate(raw_links):
        order = link.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            link = {**link, "order": i + 1}
        links_with_order.append(link)
    links = sorted(links_with_order, key=lambda l: int(l.get("order", 0)))
    actor_nodes = []
    for i, a in enumerate(actors):
        actor_nodes.append({
            "id": a.get("id", f"a{i}"),
            "type": "actor",
            "position": {"x": 0, "y": 0},
            "data": {"label": a.get("name", a.get("id", "Actor"))},
        })
    use_case_nodes = []
    for i, uc in enumerate(use_cases):
        use_case_nodes.append({
            "id": uc.get("id", f"uc{i}"),
            "type": "useCase",
            "position": {"x": 0, "y": 0},
            "data": {"label": uc.get("name", uc.get("id", "Use Case"))},
        })
    # Miro-style: one column per actor, use cases stacked under their primary actor
    _layout_usecase_swimlane(
        actor_nodes,
        use_case_nodes,
        links,
        column_width=min(220, max(160, 12000 // max(1, len(actors) + 1))),
        use_case_row_height=52,
    )
    nodes = actor_nodes + use_case_nodes
    edges = []
    for j, link in enumerate(links):
        edges.append({
            "id": f"link-{j}",
            "source": link.get("actorId", ""),
            "target": link.get("useCaseId", ""),
            "label": str(j + 1),
        })
    for j, inc in enumerate(includes):
        edges.append({
            "id": f"inc-{j}",
            "source": inc.get("from", ""),
            "target": inc.get("to", ""),
            "label": "includes",
        })
    for j, ext in enumerate(extends):
        edges.append({
            "id": f"ext-{j}",
            "source": ext.get("from", ""),
            "target": ext.get("to", ""),
            "label": "extends",
        })
    return {"nodes": nodes, "edges": edges}


def _gen_activity(plan: dict) -> dict:
    uml_nodes = plan.get("nodes", [])
    raw_edges = plan.get("edges", [])
    # Normalize order; sort by order for flow and numbering
    edges_with_order = []
    for i, e in enumerate(raw_edges):
        order = e.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            e = {**e, "order": i + 1}
        edges_with_order.append(e)
    uml_edges = sorted(edges_with_order, key=lambda x: int(x.get("order", 0)))
    nodes = []
    edges = []
    for i, n in enumerate(uml_nodes):
        nid = n.get("id", f"n{i}")
        nodes.append({
            "id": nid,
            "type": "activityNode",
            "position": {"x": 0, "y": 0},
            "data": {"label": n.get("label", nid), "nodeType": n.get("type", "activity")},
        })
    _layout(nodes, width=220, row_height=100)
    for j, e in enumerate(uml_edges):
        label = (e.get("label") or "").strip()
        step_label = f"{j + 1}. {label}" if label else str(j + 1)
        edges.append({
            "id": f"e-{j}",
            "source": e.get("from", ""),
            "target": e.get("to", ""),
            "label": step_label,
        })
    return {"nodes": nodes, "edges": edges}


def _gen_state(plan: dict) -> dict:
    states = plan.get("states", [])
    raw_transitions = plan.get("transitions", [])
    # Normalize order; sort by order for numbered display
    transitions_with_order = []
    for i, t in enumerate(raw_transitions):
        order = t.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            t = {**t, "order": i + 1}
        transitions_with_order.append(t)
    transitions = sorted(transitions_with_order, key=lambda x: int(x.get("order", 0)))
    nodes = []
    edges = []
    for i, s in enumerate(states):
        sid = s.get("id", f"s{i}")
        nodes.append({
            "id": sid,
            "type": "stateNode",
            "position": {"x": 0, "y": 0},
            "data": {
                "label": s.get("name", sid),
                "isInitial": s.get("isInitial", False),
                "isFinal": s.get("isFinal", False),
            },
        })
    _layout(nodes, width=220, row_height=120)
    for j, t in enumerate(transitions):
        label = (t.get("label") or "").strip()
        step_label = f"{j + 1}. {label}" if label else str(j + 1)
        edges.append({
            "id": f"t-{j}",
            "source": t.get("from", ""),
            "target": t.get("to", ""),
            "label": step_label,
        })
    return {"nodes": nodes, "edges": edges}


def _gen_component(plan: dict) -> dict:
    components = plan.get("components", [])
    raw_deps = plan.get("dependencies", [])
    # Normalize order; sort by order for numbered display
    deps_with_order = []
    for i, d in enumerate(raw_deps):
        order = d.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            d = {**d, "order": i + 1}
        deps_with_order.append(d)
    dependencies = sorted(deps_with_order, key=lambda x: int(x.get("order", 0)))
    nodes = []
    edges = []
    for i, c in enumerate(components):
        cid = c.get("id", f"c{i}")
        nodes.append({
            "id": cid,
            "type": "component",
            "position": {"x": 0, "y": 0},
            "data": {"label": c.get("name", cid)},
        })
    _layout(nodes, width=260, row_height=120)
    for j, d in enumerate(dependencies):
        label = (d.get("label") or "").strip()
        step_label = f"{j + 1}. {label}" if label else str(j + 1)
        edges.append({
            "id": f"dep-{j}",
            "source": d.get("from", ""),
            "target": d.get("to", ""),
            "label": step_label,
        })
    return {"nodes": nodes, "edges": edges}


def _gen_deployment(plan: dict) -> dict:
    uml_nodes = plan.get("nodes", [])
    artifacts = plan.get("artifacts", [])
    connections = plan.get("connections", [])
    explanation = plan.get("explanation", "").strip()
    nodes = []
    edges = []

    # Flow layout: one row left-to-right, large spacing so nothing overlaps
    start_x, start_y = 80, 80
    step_x = 360  # horizontal gap between nodes
    step_y_artifacts = 200  # artifacts row below

    for i, n in enumerate(uml_nodes):
        nid = n.get("id", f"n{i}")
        nodes.append({
            "id": nid,
            "type": "deployment",
            "position": {"x": start_x + i * step_x, "y": start_y},
            "data": {
                "label": n.get("name", nid),
                "nodeType": n.get("type", "device"),
                "description": n.get("description", ""),
            },
        })

    for i, a in enumerate(artifacts):
        aid = a.get("id", f"a{i}")
        # Artifacts in a row below, spaced out
        nodes.append({
            "id": aid,
            "type": "artifact",
            "position": {"x": start_x + i * step_x, "y": start_y + step_y_artifacts},
            "data": {
                "label": a.get("name", aid),
                "nodeId": a.get("nodeId", ""),
                "description": a.get("description", ""),
            },
        })

    # Normalize order; sort by order so step numbers match flow
    conns_with_order = []
    for i, c in enumerate(connections):
        order = c.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            c = {**c, "order": i + 1}
        conns_with_order.append(c)
    sorted_conns = sorted(conns_with_order, key=lambda c: int(c.get("order", 0)))
    for j, conn in enumerate(sorted_conns):
        label = (conn.get("label") or "").strip()
        step_label = f"{j + 1}. {label}" if label else str(j + 1)
        edges.append({
            "id": f"conn-{j}",
            "source": conn.get("from", ""),
            "target": conn.get("to", ""),
            "label": step_label,
            "markerEnd": "arrowclosed",
            "type": "smoothstep",
        })
    out = {"nodes": nodes, "edges": edges}
    if explanation:
        out["explanation"] = explanation
    return out
