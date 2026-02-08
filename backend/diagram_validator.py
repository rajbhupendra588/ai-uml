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


def _truncate_string(s: Any, max_len: int = 80) -> str:
    """Safely stringify and truncate for error messages."""
    if s is None:
        return "null"
    t = str(s).strip()
    return t[:max_len] + "..." if len(t) > max_len else t


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
        repaired_components.append({"name": name[:60], "type": ctype})

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
                    repaired_layers[key].append({"name": name[:50], "type": t, "tech": (item.get("tech") or "")[:40]})
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


# --- LLD ---
def validate_lld(plan: dict) -> ValidationResult:
    """Validate LLD plan: modules with classes/interfaces, dependencies (from/to must reference module names)."""
    errors: list[str] = []
    modules = _ensure_list(plan, "modules")
    dependencies = _ensure_list(plan, "dependencies")

    module_names = set()
    repaired_modules = []
    for i, mod in enumerate(modules):
        if not isinstance(mod, dict):
            continue
        name = (mod.get("name") or "").strip() or f"Module_{i}"
        name = name[:50]
        module_names.add(name)
        classes = _ensure_list(mod, "classes")
        interfaces = _ensure_list(mod, "interfaces")
        repaired_classes = []
        for j, c in enumerate(classes):
            if isinstance(c, dict):
                cn = (c.get("name") or "").strip() or f"Class_{j}"
                attrs = c.get("attributes")
                attrs = (attrs[:8] if isinstance(attrs, list) else [])
                methods = c.get("methods")
                methods = (methods[:8] if isinstance(methods, list) else [])
                repaired_classes.append({
                    "name": cn[:50],
                    "attributes": [str(a)[:60] for a in attrs],
                    "methods": [str(m)[:60] for m in methods],
                })
        repaired_interfaces = []
        for k, iface in enumerate(interfaces):
            if isinstance(iface, dict):
                iname = (iface.get("name") or "").strip() or f"I_{k}"
                imethods = iface.get("methods")
                imethods = (imethods[:8] if isinstance(imethods, list) else [])
                repaired_interfaces.append({
                    "name": iname[:50],
                    "methods": [str(m)[:60] for m in imethods],
                })
        repaired_modules.append({
            "name": name,
            "classes": repaired_classes,
            "interfaces": repaired_interfaces,
        })

    if not repaired_modules:
        errors.append("No valid modules")
        repaired_modules = [
            {
                "name": "ExampleModule",
                "classes": [{"name": "Example", "attributes": ["id: string"], "methods": ["doSomething()"]}],
                "interfaces": [],
            }
        ]
        module_names = {"ExampleModule"}

    repaired_deps = []
    for d in dependencies:
        if not isinstance(d, dict):
            continue
        fr = (d.get("from") or "").strip()[:50]
        to = (d.get("to") or "").strip()[:50]
        if fr in module_names and to in module_names:
            dtype = (d.get("type") or "uses").strip().lower()
            if dtype not in CLASS_RELATIONSHIP_TYPES:
                dtype = "uses"
            repaired_deps.append({
                "from": fr,
                "to": to,
                "type": dtype,
                "label": (d.get("label") or "")[:40],
            })

    # Bounds: 2–15 modules
    if len(repaired_modules) > 15:
        repaired_modules = repaired_modules[:15]
        module_names = {m["name"] for m in repaired_modules}
        repaired_deps = [d for d in repaired_deps if d["from"] in module_names and d["to"] in module_names]

    repaired = {"type": "lld", "modules": repaired_modules, "dependencies": repaired_deps}
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
        repaired_classes.append({
            "name": name[:50],
            "attributes": [str(a)[:60] for a in attrs],
            "methods": [str(m)[:60] for m in methods],
        })

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
        repaired_participants.append({"id": pid, "name": (p.get("name") or pid)[:40]})

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
        repaired_actors.append({"id": aid, "name": (a.get("name") or aid)[:40]})

    uc_ids = set()
    repaired_ucs = []
    for i, uc in enumerate(use_cases):
        if not isinstance(uc, dict):
            continue
        ucid = (uc.get("id") or f"uc{i}").strip()[:30]
        if not ucid:
            ucid = f"uc{i}"
        uc_ids.add(ucid)
        repaired_ucs.append({"id": ucid, "name": (uc.get("name") or ucid)[:40]})

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
        repaired_nodes.append({"id": nid, "type": ntype, "label": (n.get("label") or nid)[:50]})

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
        repaired_states.append({
            "id": sid,
            "name": (s.get("name") or sid)[:40],
            "isInitial": initial,
            "isFinal": bool(s.get("isFinal")),
        })

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
        repaired_comps.append({"id": cid, "name": (c.get("name") or cid)[:40]})

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


# --- Mind tree ---
def validate_mindtree(plan: dict) -> ValidationResult:
    """Validate mind tree plan: nodes with id, label, parentId; exactly one root; parentId references valid ids."""
    errors: list[str] = []
    nodes = _ensure_list(plan, "nodes")

    node_ids = set()
    repaired_nodes = []
    root_count = 0
    for i, n in enumerate(nodes):
        if not isinstance(n, dict):
            continue
        nid = (n.get("id") or f"n{i}").strip()[:30]
        if not nid:
            nid = f"n{i}"
        node_ids.add(nid)
        parent_id = n.get("parentId")
        if parent_id is None:
            root_count += 1
        repaired_nodes.append({
            "id": nid,
            "label": (n.get("label") or nid)[:60],
            "parentId": parent_id if parent_id is None else (str(parent_id).strip()[:30] if parent_id else None),
        })

    if not repaired_nodes:
        errors.append("No valid nodes")
        repaired_nodes = [
            {"id": "n0", "label": "Central Idea", "parentId": None},
            {"id": "n1", "label": "Branch", "parentId": "n0"},
        ]
        node_ids = {"n0", "n1"}
        root_count = 1

    # Ensure exactly one root
    if root_count == 0:
        repaired_nodes[0]["parentId"] = None
        root_count = 1
    elif root_count > 1:
        for r in repaired_nodes:
            if r["parentId"] is None and r["id"] != repaired_nodes[0]["id"]:
                r["parentId"] = repaired_nodes[0]["id"]
                root_count -= 1
                if root_count <= 1:
                    break

    # Fix invalid parentId references (point to root)
    root_id = next((n["id"] for n in repaired_nodes if n.get("parentId") is None), repaired_nodes[0]["id"] if repaired_nodes else None)
    for r in repaired_nodes:
        pid = r.get("parentId")
        if pid is not None and pid not in node_ids:
            r["parentId"] = root_id

    # Bounds: 2–25 nodes
    if len(repaired_nodes) > 25:
        repaired_nodes = repaired_nodes[:25]
        node_ids = {n["id"] for n in repaired_nodes}
        errors.append("Trimmed nodes to 25")

    repaired = {"nodes": repaired_nodes}
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
        repaired_nodes.append({
            "id": nid,
            "name": (n.get("name") or nid)[:40],
            "type": ntype,
            "description": (n.get("description") or "")[:80],
        })

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
        repaired_artifacts.append({
            "id": aid,
            "name": (a.get("name") or aid)[:40],
            "nodeId": node_id,
            "description": (a.get("description") or "")[:80],
        })

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

    repaired = {
        "nodes": repaired_nodes,
        "artifacts": repaired_artifacts,
        "connections": repaired_conns,
        "explanation": (plan.get("explanation") or "").strip()[:500],
    }
    return ValidationResult(is_valid=len(errors) == 0, errors=errors, repaired=repaired if errors else None)


_VALIDATORS = {
    "architecture": validate_architecture,
    "hld": validate_hld,
    "lld": validate_lld,
    "mindtree": validate_mindtree,
    "class": validate_class,
    "sequence": validate_sequence,
    "usecase": validate_usecase,
    "activity": validate_activity,
    "state": validate_state,
    "component": validate_component,
    "deployment": validate_deployment,
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
