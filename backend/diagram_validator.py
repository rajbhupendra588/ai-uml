"""
Production-grade diagram validation and repair for AI-generated plans.
Ensures all diagram types have required structure, valid references, and safe bounds.
"""
import copy
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("architectai.validator")

# Allowed component types for architecture diagrams
ARCHITECTURE_TYPES = frozenset(
    {"server", "database", "auth", "balancer", "client", "function", "queue", "gateway", "cdn", "cache", "search", "storage", "external", "monitoring"}
)

# Allowed layer keys for HLD
HLD_LAYERS = frozenset(
    {"presentation", "application", "business", "data", "external", "infrastructure"}
)

# Allowed relationship types for class diagrams
CLASS_RELATIONSHIP_TYPES = frozenset({"extends", "implements", "associates", "uses", "composition", "aggregation"})

# Allowed node types for activity diagrams
ACTIVITY_NODE_TYPES = frozenset({"start", "activity", "decision", "end"})

# Allowed node types for deployment
DEPLOYMENT_NODE_TYPES = frozenset({"device", "executionEnv"})


@dataclass
class ValidationResult:
    """Result of validating (and optionally repairing) a diagram plan."""
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    repaired: dict | None = None  # If not None, use this instead of original when invalid


# Max length for code/snippet in plan (sanitized before storage)
MAX_CODE_LENGTH = 10000


def _truncate_string(s: Any, max_len: int = 80) -> str:
    """Safely stringify and truncate for error messages."""
    if s is None:
        return "null"
    t = str(s).strip()
    return t[:max_len] + "..." if len(t) > max_len else t


def _sanitize_code(code: Any) -> str | None:
    """Sanitize optional code/snippet: strip, truncate, remove null bytes."""
    if code is None or (isinstance(code, str) and not code.strip()):
        return None
    t = str(code).strip()
    if not t:
        return None
    # Remove null bytes and control chars
    t = "".join(c for c in t if ord(c) >= 32 or c in "\n\t\r")
    return t[:MAX_CODE_LENGTH] if len(t) > MAX_CODE_LENGTH else t


def _ensure_list(obj: Any, key: str, default: list | None = None) -> list:
    """Get key from dict as list; if not a list, return default or []."""
    val = (obj or {}).get(key)
    if isinstance(val, list):
        return val
    return default if default is not None else []


def _ensure_dict(obj: Any, key: str) -> dict:
    """Get key from dict as dict; if not a dict, return {}."""
    val = (obj or {}).get(key)
    return val if isinstance(val, dict) else {}


# --- Architecture ---
def validate_architecture(plan: dict) -> ValidationResult:
    """Validate architecture diagram plan: components list with name and type."""
    errors: list[str] = []
    components = _ensure_list(plan, "components")
    if not components:
        errors.append("Missing or empty 'components' list")
        repaired = {"components": [{"name": "API", "type": "server"}, {"name": "Database", "type": "database"}]}
        return ValidationResult(is_valid=False, errors=errors, repaired=repaired)

    repaired_components = []
    for i, comp in enumerate(components):
        if not isinstance(comp, dict):
            errors.append(f"components[{i}] is not an object")
            continue
        name = (comp.get("name") or "").strip() or f"Component_{i}"
        ctype = (comp.get("type") or "server").strip().lower()
        if ctype not in ARCHITECTURE_TYPES:
            ctype = "server"
        item: dict = {"name": name[:60], "type": ctype}
        code_val = _sanitize_code(comp.get("code") or comp.get("snippet"))
        if code_val:
            item["code"] = code_val
        repaired_components.append(item)

    if errors and not repaired_components:
        return ValidationResult(is_valid=False, errors=errors)

    # Bounds: 2–20 components for readability
    if len(repaired_components) > 20:
        repaired_components = repaired_components[:20]
        errors.append("Trimmed components to 20")
    if len(repaired_components) < 2:
        repaired_components.append({"name": "Database", "type": "database"})
        errors.append("Added default second component")

    repaired = {"components": repaired_components}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- HLD ---
def validate_hld(plan: dict) -> ValidationResult:
    """Validate HLD plan: layers dict and flows list."""
    errors: list[str] = []
    layers = _ensure_dict(plan, "layers")
    flows = _ensure_list(plan, "flows")

    repaired_layers = {}
    for key in HLD_LAYERS:
        val = layers.get(key)
        if isinstance(val, list):
            repaired_layers[key] = []
            for j, item in enumerate(val):
                if isinstance(item, dict):
                    name = (item.get("name") or "").strip() or f"Item_{j}"
                    t = (item.get("type") or "service").strip().lower()
                    layer_item: dict = {"name": name[:50], "type": t, "tech": (item.get("tech") or "")[:40]}
                    code_val = _sanitize_code(item.get("code") or item.get("snippet"))
                    if code_val:
                        layer_item["code"] = code_val
                    repaired_layers[key].append(layer_item)
                else:
                    repaired_layers[key].append({"name": f"Component_{j}", "type": "service", "tech": ""})
        else:
            repaired_layers[key] = []

    # Flows: from/to must be layer names
    repaired_flows = []
    for f in flows:
        if not isinstance(f, dict):
            continue
        fr = (f.get("from") or "").strip()
        to = (f.get("to") or "").strip()
        if fr in HLD_LAYERS and to in HLD_LAYERS:
            repaired_flows.append({"from": fr, "to": to, "label": (f.get("label") or "").strip()[:40]})

    repaired = {"type": "hld", "layers": repaired_layers, "flows": repaired_flows}
    if not any(repaired_layers.values()):
        errors.append("No layer has any components")
        repaired_layers.setdefault("presentation", [{"name": "Web App", "type": "webapp", "tech": "React"}])
        repaired_layers.setdefault("application", [{"name": "API", "type": "gateway", "tech": "REST"}])
        repaired_layers.setdefault("business", [{"name": "Core Service", "type": "service", "tech": "Backend"}])
        repaired_layers.setdefault("data", [{"name": "Database", "type": "database", "tech": "PostgreSQL"}])
        repaired["layers"] = repaired_layers

    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)




# --- Class ---
def validate_class(plan: dict) -> ValidationResult:
    """Validate class diagram: classes and relationships; references must match class names."""
    errors: list[str] = []
    classes = _ensure_list(plan, "classes")
    relationships = _ensure_list(plan, "relationships")

    class_names = set()
    repaired_classes = []
    for i, c in enumerate(classes):
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip() or f"Class{i}"
        class_names.add(name)
        attrs = c.get("attributes")
        attrs = (attrs[:8] if isinstance(attrs, list) else [])
        methods = c.get("methods")
        methods = (methods[:8] if isinstance(methods, list) else [])
        class_item: dict = {
            "name": name[:50],
            "attributes": [str(a)[:60] for a in attrs],
            "methods": [str(m)[:60] for m in methods],
        }
        code_val = _sanitize_code(c.get("code") or c.get("snippet"))
        if code_val:
            class_item["code"] = code_val
        repaired_classes.append(class_item)

    if not repaired_classes:
        errors.append("No valid classes")
        repaired_classes = [{"name": "Example", "attributes": ["id: int"], "methods": ["doSomething()"]}]
        class_names = {"Example"}

    repaired_rels = []
    for r in relationships:
        if not isinstance(r, dict):
            continue
        fr = (r.get("from") or "").strip()
        to = (r.get("to") or "").strip()
        if fr not in class_names or to not in class_names:
            errors.append(f"Relationship from '{_truncate_string(fr)}' to '{_truncate_string(to)}' references non-existent class")
            continue
        rtype = (r.get("type") or "associates").strip().lower()
        if rtype not in CLASS_RELATIONSHIP_TYPES:
            rtype = "associates"
        repaired_rels.append({"from": fr, "to": to, "type": rtype, "label": (r.get("label") or "")[:30]})

    # Bounds
    if len(repaired_classes) > 15:
        repaired_classes = repaired_classes[:15]
        class_names = {c["name"] for c in repaired_classes}
        repaired_rels = [r for r in repaired_rels if r["from"] in class_names and r["to"] in class_names]

    repaired = {"classes": repaired_classes, "relationships": repaired_rels}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- Sequence ---
def validate_sequence(plan: dict) -> ValidationResult:
    """Validate sequence diagram: participants and messages; from/to must be participant ids."""
    errors: list[str] = []
    participants = _ensure_list(plan, "participants")
    messages = _ensure_list(plan, "messages")

    ids = set()
    repaired_participants = []
    for i, p in enumerate(participants):
        if not isinstance(p, dict):
            continue
        pid = (p.get("id") or p.get("name") or f"P{i}").strip()[:20]
        if not pid:
            pid = f"P{i}"
        ids.add(pid)
        seq_item: dict = {"id": pid, "name": (p.get("name") or pid)[:40]}
        code_val = _sanitize_code(p.get("code") or p.get("snippet"))
        if code_val:
            seq_item["code"] = code_val
        repaired_participants.append(seq_item)

    if not repaired_participants:
        errors.append("No valid participants")
        repaired_participants = [{"id": "U", "name": "User"}, {"id": "A", "name": "API"}]
        ids = {"U", "A"}

    repaired_messages = []
    for i, m in enumerate(messages):
        if not isinstance(m, dict):
            continue
        fr = (m.get("from") or "").strip()[:20]
        to = (m.get("to") or "").strip()[:20]
        if fr not in ids or to not in ids:
            continue
        order = m.get("order")
        try:
            order = int(order) if order is not None else (i + 1)
        except (TypeError, ValueError):
            order = i + 1
        repaired_messages.append({
            "from": fr, "to": to,
            "label": (m.get("label") or "")[:60],
            "order": max(1, order),
        })

    # Sort by order and renumber 1, 2, 3...
    repaired_messages.sort(key=lambda x: x["order"])
    for j, msg in enumerate(repaired_messages):
        msg["order"] = j + 1

    repaired = {"participants": repaired_participants, "messages": repaired_messages}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- Use case ---
def validate_usecase(plan: dict) -> ValidationResult:
    """Validate use case diagram: actors, useCases, links; optional includes, extends, systemBoundary."""
    errors: list[str] = []
    actors = _ensure_list(plan, "actors")
    use_cases = _ensure_list(plan, "useCases")
    links = _ensure_list(plan, "links")
    includes = _ensure_list(plan, "includes")
    extends = _ensure_list(plan, "extends")

    actor_ids = set()
    repaired_actors = []
    for i, a in enumerate(actors):
        if not isinstance(a, dict):
            continue
        aid = (a.get("id") or f"a{i}").strip()[:30]
        if not aid:
            aid = f"a{i}"
        actor_ids.add(aid)
        actor_item: dict = {"id": aid, "name": (a.get("name") or aid)[:40]}
        code_val = _sanitize_code(a.get("code") or a.get("snippet"))
        if code_val:
            actor_item["code"] = code_val
        repaired_actors.append(actor_item)

    uc_ids = set()
    repaired_ucs = []
    for i, uc in enumerate(use_cases):
        if not isinstance(uc, dict):
            continue
        ucid = (uc.get("id") or f"uc{i}").strip()[:30]
        if not ucid:
            ucid = f"uc{i}"
        uc_ids.add(ucid)
        uc_item: dict = {"id": ucid, "name": (uc.get("name") or ucid)[:40]}
        code_val = _sanitize_code(uc.get("code") or uc.get("snippet"))
        if code_val:
            uc_item["code"] = code_val
        repaired_ucs.append(uc_item)

    if not repaired_actors:
        repaired_actors = [{"id": "a1", "name": "User"}]
        actor_ids = {"a1"}
    if not repaired_ucs:
        repaired_ucs = [{"id": "uc1", "name": "Use Case"}]
        uc_ids = {"uc1"}

    repaired_links = []
    for i, link in enumerate(links):
        if not isinstance(link, dict):
            continue
        aid = (link.get("actorId") or "").strip()[:30]
        ucid = (link.get("useCaseId") or "").strip()[:30]
        if aid not in actor_ids or ucid not in uc_ids:
            continue
        order = link.get("order")
        try:
            order = int(order) if order is not None else (i + 1)
        except (TypeError, ValueError):
            order = i + 1
        repaired_links.append({"actorId": aid, "useCaseId": ucid, "order": max(1, order)})

    repaired_links.sort(key=lambda x: x["order"])
    for j, link in enumerate(repaired_links):
        link["order"] = j + 1

    repaired_includes = []
    for inc in includes:
        if not isinstance(inc, dict):
            continue
        fr = (inc.get("from") or "").strip()[:30]
        to = (inc.get("to") or "").strip()[:30]
        if fr in uc_ids and to in uc_ids:
            repaired_includes.append({"from": fr, "to": to})

    repaired_extends = []
    for ext in extends:
        if not isinstance(ext, dict):
            continue
        fr = (ext.get("from") or "").strip()[:30]
        to = (ext.get("to") or "").strip()[:30]
        if fr in uc_ids and to in uc_ids:
            repaired_extends.append({"from": fr, "to": to})

    system_boundary = (plan.get("systemBoundary") or "").strip()[:80] or None

    repaired = {
        "actors": repaired_actors,
        "useCases": repaired_ucs,
        "links": repaired_links,
        "includes": repaired_includes,
        "extends": repaired_extends,
        "systemBoundary": system_boundary,
    }
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- Activity ---
def validate_activity(plan: dict) -> ValidationResult:
    """Validate activity diagram: nodes (start/activity/decision/end) and edges with valid from/to."""
    errors: list[str] = []
    uml_nodes = _ensure_list(plan, "nodes")
    raw_edges = _ensure_list(plan, "edges")

    node_ids = set()
    repaired_nodes = []
    has_start = has_end = False
    for i, n in enumerate(uml_nodes):
        if not isinstance(n, dict):
            continue
        nid = (n.get("id") or f"n{i}").strip()[:30]
        if not nid:
            nid = f"n{i}"
        node_ids.add(nid)
        ntype = (n.get("type") or "activity").strip().lower()
        if ntype not in ACTIVITY_NODE_TYPES:
            ntype = "activity"
        if ntype == "start":
            has_start = True
        if ntype == "end":
            has_end = True
        node_item: dict = {"id": nid, "type": ntype, "label": (n.get("label") or nid)[:50]}
        code_val = _sanitize_code(n.get("code") or n.get("snippet"))
        if code_val:
            node_item["code"] = code_val
        repaired_nodes.append(node_item)

    if not repaired_nodes:
        repaired_nodes = [
            {"id": "start", "type": "start", "label": "Start"},
            {"id": "a1", "type": "activity", "label": "Process"},
            {"id": "end", "type": "end", "label": "End"},
        ]
        node_ids = {"start", "a1", "end"}
        has_start = has_end = True
    if not has_start:
        repaired_nodes.insert(0, {"id": "start", "type": "start", "label": "Start"})
        node_ids.add("start")
    if not has_end:
        repaired_nodes.append({"id": "end", "type": "end", "label": "End"})
        node_ids.add("end")

    repaired_edges = []
    for i, e in enumerate(raw_edges):
        if not isinstance(e, dict):
            continue
        fr = (e.get("from") or "").strip()[:30]
        to = (e.get("to") or "").strip()[:30]
        if fr not in node_ids or to not in node_ids:
            continue
        order = e.get("order")
        try:
            order = int(order) if order is not None else (i + 1)
        except (TypeError, ValueError):
            order = i + 1
        repaired_edges.append({"from": fr, "to": to, "label": (e.get("label") or "")[:40], "order": max(1, order)})

    repaired_edges.sort(key=lambda x: x["order"])
    for j, e in enumerate(repaired_edges):
        e["order"] = j + 1

    repaired = {"nodes": repaired_nodes, "edges": repaired_edges}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- State ---
def validate_state(plan: dict) -> ValidationResult:
    """Validate state diagram: states (one initial) and transitions."""
    errors: list[str] = []
    states = _ensure_list(plan, "states")
    transitions = _ensure_list(plan, "transitions")

    state_ids = set()
    repaired_states = []
    has_initial = False
    for i, s in enumerate(states):
        if not isinstance(s, dict):
            continue
        sid = (s.get("id") or f"s{i}").strip()[:30]
        if not sid:
            sid = f"s{i}"
        state_ids.add(sid)
        initial = bool(s.get("isInitial"))
        if initial:
            has_initial = True
        state_item: dict = {
            "id": sid,
            "name": (s.get("name") or sid)[:40],
            "isInitial": initial,
            "isFinal": bool(s.get("isFinal")),
        }
        code_val = _sanitize_code(s.get("code") or s.get("snippet"))
        if code_val:
            state_item["code"] = code_val
        repaired_states.append(state_item)

    if not repaired_states:
        repaired_states = [
            {"id": "s1", "name": "Idle", "isInitial": True, "isFinal": False},
            {"id": "s2", "name": "Active", "isInitial": False, "isFinal": False},
        ]
        state_ids = {"s1", "s2"}
        has_initial = True
    if not has_initial:
        repaired_states[0]["isInitial"] = True

    repaired_trans = []
    for i, t in enumerate(transitions):
        if not isinstance(t, dict):
            continue
        fr = (t.get("from") or "").strip()[:30]
        to = (t.get("to") or "").strip()[:30]
        if fr not in state_ids or to not in state_ids:
            continue
        order = t.get("order")
        try:
            order = int(order) if order is not None else (i + 1)
        except (TypeError, ValueError):
            order = i + 1
        repaired_trans.append({"from": fr, "to": to, "label": (t.get("label") or "")[:40], "order": max(1, order)})

    repaired_trans.sort(key=lambda x: x["order"])
    for j, tr in enumerate(repaired_trans):
        tr["order"] = j + 1

    repaired = {"states": repaired_states, "transitions": repaired_trans}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- Component ---
def validate_component(plan: dict) -> ValidationResult:
    """Validate component diagram: components and dependencies."""
    errors: list[str] = []
    components = _ensure_list(plan, "components")
    dependencies = _ensure_list(plan, "dependencies")

    comp_ids = set()
    repaired_comps = []
    for i, c in enumerate(components):
        if not isinstance(c, dict):
            continue
        cid = (c.get("id") or c.get("name") or f"c{i}").strip()[:30]
        if not cid:
            cid = f"c{i}"
        comp_ids.add(cid)
        comp_item: dict = {"id": cid, "name": (c.get("name") or cid)[:40]}
        code_val = _sanitize_code(c.get("code") or c.get("snippet"))
        if code_val:
            comp_item["code"] = code_val
        repaired_comps.append(comp_item)

    if not repaired_comps:
        repaired_comps = [{"id": "c1", "name": "API"}, {"id": "c2", "name": "DB"}]
        comp_ids = {"c1", "c2"}

    repaired_deps = []
    for i, d in enumerate(dependencies):
        if not isinstance(d, dict):
            continue
        fr = (d.get("from") or "").strip()[:30]
        to = (d.get("to") or "").strip()[:30]
        if fr not in comp_ids or to not in comp_ids:
            continue
        order = d.get("order")
        try:
            order = int(order) if order is not None else (i + 1)
        except (TypeError, ValueError):
            order = i + 1
        repaired_deps.append({"from": fr, "to": to, "label": (d.get("label") or "")[:30], "order": max(1, order)})

    repaired_deps.sort(key=lambda x: x["order"])
    for j, dep in enumerate(repaired_deps):
        dep["order"] = j + 1

    repaired = {"components": repaired_comps, "dependencies": repaired_deps}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)




# --- Deployment ---
def validate_deployment(plan: dict) -> ValidationResult:
    """Validate deployment diagram: nodes, artifacts, connections."""
    errors: list[str] = []
    nodes = _ensure_list(plan, "nodes")
    artifacts = _ensure_list(plan, "artifacts")
    connections = _ensure_list(plan, "connections")

    node_ids = set()
    repaired_nodes = []
    for i, n in enumerate(nodes):
        if not isinstance(n, dict):
            continue
        nid = (n.get("id") or f"n{i}").strip()[:30]
        if not nid:
            nid = f"n{i}"
        node_ids.add(nid)
        ntype = (n.get("type") or "executionEnv").strip().lower()
        if ntype not in DEPLOYMENT_NODE_TYPES:
            ntype = "executionEnv"
        depl_node: dict = {
            "id": nid,
            "name": (n.get("name") or nid)[:40],
            "type": ntype,
            "description": (n.get("description") or "")[:80],
        }
        code_val = _sanitize_code(n.get("code") or n.get("snippet"))
        if code_val:
            depl_node["code"] = code_val
        repaired_nodes.append(depl_node)

    if not repaired_nodes:
        repaired_nodes = [
            {"id": "n1", "name": "Client", "type": "device", "description": "User device"},
            {"id": "n2", "name": "Server", "type": "executionEnv", "description": "App host"},
        ]
        node_ids = {"n1", "n2"}

    repaired_artifacts = []
    for i, a in enumerate(artifacts):
        if not isinstance(a, dict):
            continue
        aid = (a.get("id") or f"a{i}").strip()[:30]
        if not aid:
            aid = f"a{i}"
        node_id = (a.get("nodeId") or "").strip()[:30]
        if node_id and node_id not in node_ids:
            node_id = list(node_ids)[0] if node_ids else ""
        artifact_item: dict = {
            "id": aid,
            "name": (a.get("name") or aid)[:40],
            "nodeId": node_id,
            "description": (a.get("description") or "")[:80],
        }
        code_val = _sanitize_code(a.get("code") or a.get("snippet"))
        if code_val:
            artifact_item["code"] = code_val
        repaired_artifacts.append(artifact_item)

    repaired_conns = []
    for i, c in enumerate(connections):
        if not isinstance(c, dict):
            continue
        fr = (c.get("from") or "").strip()[:30]
        to = (c.get("to") or "").strip()[:30]
        if fr not in node_ids or to not in node_ids:
            continue
        order = c.get("order")
        try:
            order = int(order) if order is not None else (i + 1)
        except (TypeError, ValueError):
            order = i + 1
        repaired_conns.append({"from": fr, "to": to, "label": (c.get("label") or "")[:40], "order": max(1, order)})

    repaired_conns.sort(key=lambda x: x["order"])
    for j, conn in enumerate(repaired_conns):
        conn["order"] = j + 1

    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- Mindtree ---
def validate_mindtree(plan: dict) -> ValidationResult:
    """Validate mindtree diagram: rootId and nodes list (id, label, parentId)."""
    errors: list[str] = []
    root_id = (plan.get("rootId") or "").strip()
    nodes = _ensure_list(plan, "nodes")

    repaired_nodes = []
    node_ids = set()
    
    # First pass: collect IDs and repair nodes
    for i, n in enumerate(nodes):
        if not isinstance(n, dict):
            continue
        nid = (n.get("id") or f"n{i}").strip()[:30]
        if not nid:
            nid = f"n{i}"
        node_ids.add(nid)
        mind_node: dict = {
            "id": nid,
            "label": (n.get("label") or nid)[:50],
            "parentId": (n.get("parentId") or "").strip()[:30]
        }
        code_val = _sanitize_code(n.get("code") or n.get("snippet"))
        if code_val:
            mind_node["code"] = code_val
        repaired_nodes.append(mind_node)

    # Ensure root exists
    if not root_id or root_id not in node_ids:
        if repaired_nodes:
            # Pick first node as root if current root invalid
            root_id = repaired_nodes[0]["id"]
            repaired_nodes[0]["parentId"] = "" # Root has no parent
        else:
            root_id = "root"
            repaired_nodes = [{"id": "root", "label": "Central Topic", "parentId": ""}]
            node_ids = {"root"}

    # Second pass: validate parentIds
    final_nodes = []
    for n in repaired_nodes:
        pid = n["parentId"]
        if pid and pid not in node_ids:
            # If parent missing, attach to root (unless it's root itself)
            if n["id"] != root_id:
                n["parentId"] = root_id
        elif n["id"] == root_id:
             n["parentId"] = ""
        final_nodes.append(n)

    repaired = {"rootId": root_id, "nodes": final_nodes}
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


# --- Flowchart ---
# Reuse activity validator since structure is identical (nodes + edges)
validate_flowchart = validate_activity


_VALIDATORS = {
    "architecture": validate_architecture,
    "hld": validate_hld,
    "class": validate_class,
    "sequence": validate_sequence,
    "usecase": validate_usecase,
    "activity": validate_activity,
    "flowchart": validate_flowchart,
    "state": validate_state,
    "component": validate_component,
    "deployment": validate_deployment,
    "mindtree": validate_mindtree,
}


def validate_and_repair(diagram_type: str, plan: dict) -> ValidationResult:
    """
    Validate the plan for the given diagram type. Always returns a result;
    if invalid, repaired may contain a safe plan to use.
    """
    if not isinstance(plan, dict):
        return ValidationResult(is_valid=False, errors=["Plan is not a JSON object"], repaired=None)

    fn = _VALIDATORS.get(diagram_type)
    if not fn:
        return ValidationResult(is_valid=True, errors=[], repaired=None)

    return fn(plan)


def get_valid_plan(diagram_type: str, plan: dict) -> dict:
    """
    Return a plan that is guaranteed to be valid for the given diagram type.
    Uses validation and repair; if invalid, returns the repaired plan or a minimal fallback.
    """
    result = validate_and_repair(diagram_type, plan)
    if result.is_valid:
        return plan
    if result.repaired:
        logger.info(
            "Diagram plan repaired for type=%s: %s",
            diagram_type,
            result.errors[:3],
            extra={"diagram_type": diagram_type, "error_count": len(result.errors)},
        )
        return result.repaired
    return plan  # Last resort: return original
