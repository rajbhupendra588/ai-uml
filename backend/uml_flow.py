"""
UML diagram planners (LLM) and generators (plan -> nodes/edges) for all diagram types.
"""
import json
import logging
import re
from typing import Any

logger = logging.getLogger("architectai.uml")

# --- Class diagram ---
CLASS_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a CLASS DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "classes": [
    { "name": "ClassName", "attributes": ["attr: Type"], "methods": ["method(args): ReturnType"] }
  ],
  "relationships": [
    { "from": "ClassNameA", "to": "ClassNameB", "type": "extends" | "implements" | "associates" | "uses", "label": "optional short label" }
  ]
}
Rules: Keep 3-8 classes. "from" and "to" MUST be exact class names from the classes list. Keep names and labels SHORT. Use standard UML relationship types only."""

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
USECASE_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a USE CASE DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "actors": [ { "id": "a1", "name": "Actor Name" } ],
  "useCases": [ { "id": "uc1", "name": "Use Case Name" } ],
  "links": [ { "actorId": "a1", "useCaseId": "uc1", "order": 1 } ]
}
Rules: 1-4 actors, 2-8 use cases. actorId and useCaseId MUST reference existing actor/useCase ids. Keep names SHORT. Add "order": 1, 2, 3... to links for display order."""

# --- Activity diagram ---
ACTIVITY_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract an ACTIVITY DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    { "id": "n1", "type": "start" | "activity" | "decision" | "end", "label": "Short label" }
  ],
  "edges": [ { "from": "n1", "to": "n2", "label": "short", "order": 1 } ]
}
Rules: Exactly one start and one end. "from" and "to" MUST be node ids. Edges MUST have "order": 1, 2, 3... in flow order. Keep all labels SHORT (2-5 words). Use 4-12 nodes."""

# --- State diagram ---
STATE_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a STATE DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "states": [ { "id": "s1", "name": "State Name", "isInitial": false, "isFinal": false } ],
  "transitions": [ { "from": "s1", "to": "s2", "label": "event / action", "order": 1 } ]
}
Rules: Exactly one state with isInitial: true. Optionally one isFinal: true. "from" and "to" MUST be state ids. Transitions MUST have "order": 1, 2, 3... for display. Keep labels SHORT."""

# --- Component diagram ---
COMPONENT_SYSTEM_PROMPT = """You are a software architect. From the user's description, extract a COMPONENT DIAGRAM.
Return ONLY valid JSON with this exact structure:
{
  "components": [ { "id": "c1", "name": "Component Name" } ],
  "dependencies": [ { "from": "c1", "to": "c2", "label": "optional short label", "order": 1 } ]
}
Rules: 3-8 components. "from" and "to" MUST be component ids. Add "order": 1, 2, 3... to dependencies for display. Keep names and labels SHORT."""

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


def plan_uml(diagram_type: str, prompt: str, llm) -> dict:
    """Return a plan dict for the given UML diagram type (LLM)."""
    prompts = {
        "class": CLASS_SYSTEM_PROMPT,
        "sequence": SEQUENCE_SYSTEM_PROMPT,
        "usecase": USECASE_SYSTEM_PROMPT,
        "activity": ACTIVITY_SYSTEM_PROMPT,
        "state": STATE_SYSTEM_PROMPT,
        "component": COMPONENT_SYSTEM_PROMPT,
        "deployment": DEPLOYMENT_SYSTEM_PROMPT,
    }
    sys_prompt = prompts.get(diagram_type)
    if not sys_prompt or not llm:
        return _mock_plan_uml(diagram_type, prompt)
    try:
        return _invoke_llm(sys_prompt, prompt, llm)
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
            "actors": [{"id": "a1", "name": "User"}],
            "useCases": [{"id": "uc1", "name": "Login"}, {"id": "uc2", "name": "Logout"}],
            "links": [{"actorId": "a1", "useCaseId": "uc1", "order": 1}, {"actorId": "a1", "useCaseId": "uc2", "order": 2}],
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
    return {}


def generate_uml(diagram_type: str, plan: dict) -> dict:
    """Convert UML plan to { nodes, edges } for React Flow."""
    gen = {
        "class": _gen_class,
        "sequence": _gen_sequence,
        "usecase": _gen_usecase,
        "activity": _gen_activity,
        "state": _gen_state,
        "component": _gen_component,
        "deployment": _gen_deployment,
    }
    fn = gen.get(diagram_type)
    if not fn:
        return {"nodes": [], "edges": []}
    return fn(plan)


def plan_to_mermaid(diagram_type: str, plan: dict) -> str | None:
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
        lines = ["flowchart LR"]
        # Actors on left
        for a in actors:
            aid = (a.get("id") or "a").replace("-", "_")[:20]
            name = (a.get("name") or aid).replace('"', "'")[:30]
            lines.append(f'    {aid}[/"👤 {name}"/]')
        # Use cases on right
        for uc in use_cases:
            ucid = (uc.get("id") or "uc").replace("-", "_")[:20]
            name = (uc.get("name") or ucid).replace('"', "'")[:40]
            lines.append(f'    {ucid}(("{name}"))')
        # Links
        for i, link in enumerate(links):
            aid = (link.get("actorId") or "a").replace("-", "_")[:20]
            ucid = (link.get("useCaseId") or "uc").replace("-", "_")[:20]
            lines.append(f"    {aid} --> {ucid}")
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
    # Normalize order; sort by order for numbered display
    links_with_order = []
    for i, link in enumerate(raw_links):
        order = link.get("order")
        if order is None or (isinstance(order, (int, float)) and order <= 0):
            link = {**link, "order": i + 1}
        links_with_order.append(link)
    links = sorted(links_with_order, key=lambda l: int(l.get("order", 0)))
    nodes = []
    edges = []
    for i, a in enumerate(actors):
        nodes.append({
            "id": a.get("id", f"a{i}"),
            "type": "actor",
            "position": {"x": 0, "y": 0},
            "data": {"label": a.get("name", a.get("id", "Actor"))},
        })
    for i, uc in enumerate(use_cases):
        nodes.append({
            "id": uc.get("id", f"uc{i}"),
            "type": "useCase",
            "position": {"x": 0, "y": 0},
            "data": {"label": uc.get("name", uc.get("id", "Use Case"))},
        })
    _layout(nodes, width=240, row_height=120)
    for j, link in enumerate(links):
        step_label = f"{j + 1}"
        edges.append({
            "id": f"link-{j}",
            "source": link.get("actorId", ""),
            "target": link.get("useCaseId", ""),
            "label": step_label,
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
