"""Diagram generation: plan -> Mermaid (and optional ReactFlow) output."""
import logging

from agent.state import AgentState
from agent.llm_setup import get_llm_for_request
from agent.chat import generate_chat_mermaid
from agent import layouts

logger = logging.getLogger("architectai.agent.generator")


async def generator_node(state: AgentState) -> dict:
    """
    Generates Mermaid diagram code from the plan.
    Returns multiple layout versions for Architecture and HLD diagrams.
    """
    plan = state["diagram_plan"]
    diagram_type = state.get("diagram_type") or "architecture"
    model = state.get("model") or ""
    llm_to_use = get_llm_for_request(model) if model else get_llm_for_request(None)
    logger.info(
        "generator_node",
        extra={
            "diagram_type": diagram_type,
            "plan_keys": list(plan.keys()) if isinstance(plan, dict) else [],
        },
    )

    explanation = None

    if diagram_type == "chat":
        prompt = plan.get("prompt") or state.get("prompt") or ""
        mermaid_code = await generate_chat_mermaid(prompt, llm_to_use)
        return {"json_output": {
            "mermaid": mermaid_code,
            "nodes": [],
            "edges": [],
            "versions": [{"code": mermaid_code, "layout": "Default", "direction": "TB", "description": "Generated from chat"}],
            "selectedVersion": 0,
        }}

    if diagram_type == "hld":
        code_level = (state.get("code_detail_level") or "small").lower()
        if code_level not in ("small", "complete"):
            code_level = "small"
        versions = _generate_hld_versions(plan, code_level)
        return {"json_output": {
            "mermaid": versions[0]["code"] if versions else "",
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    if diagram_type == "lld":
        versions = _generate_lld_versions(plan)
        return {"json_output": {
            "mermaid": versions[0]["code"] if versions else "",
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    if diagram_type == "mindtree":
        mermaid_code = layouts._mindtree_to_mermaid(plan)
        tidy_code = layouts._mindtree_to_mermaid_tidy(plan)
        versions = [
            {"code": mermaid_code, "layout": "Mind Map", "direction": "radial", "description": "Radial mind map"},
            {"code": tidy_code, "layout": "Tidy Tree", "direction": "TB", "description": "Hierarchical tree layout"},
        ]
        return {"json_output": {
            "mermaid": mermaid_code,
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    if diagram_type == "architecture":
        components = plan.get("components", [])
        if not components:
            return {"json_output": {"mermaid": "", "nodes": [], "edges": [], "versions": []}}

        code_level = (state.get("code_detail_level") or "small").lower()
        if code_level not in ("small", "complete"):
            code_level = "small"
        versions = [
            layouts._architecture_to_mermaid_tb(components, "Hierarchical", code_level),
            layouts._architecture_to_mermaid_lr(components, "Horizontal Flow", code_level),
            layouts._architecture_to_mermaid_grouped(components, "Grouped", code_level),
        ]
        return {"json_output": {
            "mermaid": versions[0]["code"],
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    from uml_flow import plan_to_mermaid
    code_level = (state.get("code_detail_level") or "small").lower()
    if code_level not in ("small", "complete"):
        code_level = "small"
    mermaid_code = plan_to_mermaid(diagram_type, plan, code_level)

    if diagram_type == "deployment" and isinstance(plan.get("explanation"), str):
        explanation = plan["explanation"]

    result = {
        "mermaid": mermaid_code or "",
        "nodes": [],
        "edges": [],
        "versions": [{
            "code": mermaid_code or "",
            "layout": "Default",
            "direction": "TB",
            "description": f"{diagram_type.title()} diagram",
        }],
        "selectedVersion": 0,
    }
    if explanation:
        result["explanation"] = explanation

    return {"json_output": result}


def _generate_hld_versions(plan: dict, code_detail_level: str = "small") -> list[dict]:
    """Generate multiple HLD layout versions."""
    layers = plan.get("layers", {})
    versions = []

    versions.append({
        "code": layouts._hld_to_mermaid(plan, code_detail_level),
        "layout": "Layered",
        "direction": "TB",
        "description": "Standard layered architecture view",
    })

    lines = ["flowchart LR"]
    layer_config = {
        "presentation": {"name": "Frontend", "icon": "🖥️"},
        "application": {"name": "Application", "icon": "🔌"},
        "business": {"name": "Services", "icon": "⚙️"},
        "data": {"name": "Data", "icon": "🗄️"},
        "external": {"name": "External", "icon": "🌐"},
        "infrastructure": {"name": "Infra", "icon": "🏗️"},
    }
    type_icons = {
        "webapp": "🌐", "mobile": "📱", "gateway": "🚪", "auth": "🔐", "service": "⚙️",
        "database": "🗄️", "cache": "⚡", "queue": "📬", "external": "🔗", "lb": "⚖️", "cdn": "🌍",
    }
    layer_order = ["infrastructure", "presentation", "application", "business", "data", "external"]
    layer_nodes: dict[str, list[str]] = {}
    node_counter = 0
    active_layers = [l for l in layer_order if layers.get(l)]

    for layer_key in active_layers:
        components = layers.get(layer_key, [])
        if not components:
            continue
        config = layer_config.get(layer_key, {"name": layer_key.title(), "icon": "📦"})
        layer_nodes[layer_key] = []
        lines.append(f"    subgraph {layer_key}[\"{config['icon']} {config['name']}\"]")
        lines.append("        direction TB")
        for comp in components:
            node_id = f"h{node_counter}"
            node_counter += 1
            layer_nodes[layer_key].append(node_id)
            name = layouts._sanitize_mermaid_label((comp.get("name") or "Component")[:30])
            comp_type = (comp.get("type") or "service").lower()
            icon = type_icons.get(comp_type, "📦")
            label = f"{icon} {name}"
            lines.append(f'        {node_id}["{label}"]')
        lines.append("    end")

    for i in range(len(active_layers) - 1):
        current = active_layers[i]
        next_layer = active_layers[i + 1]
        if current in layer_nodes and next_layer in layer_nodes:
            from_node = layer_nodes[current][0]
            to_node = layer_nodes[next_layer][0]
            lines.append(f"    {from_node} --> {to_node}")

    lines.extend(layouts._get_mermaid_styles())
    versions.append({
        "code": "\n".join(lines),
        "layout": "Pipeline",
        "direction": "LR",
        "description": "Left-to-right data flow view",
    })

    lines = ["flowchart TB"]
    lines.append('    User(["👤 Users"])')
    node_counter = 0
    # Track nodes per layer for smart connections
    compact_layer_nodes: dict[str, list[str]] = {}
    compact_layer_order = ["presentation", "application", "business", "data", "external", "infrastructure"]
    active_compact_layers = [l for l in compact_layer_order if layers.get(l)]

    for layer_key in active_compact_layers:
        components = layers.get(layer_key, [])
        if not components:
            continue
        compact_layer_nodes[layer_key] = []
        for comp in components:
            node_id = f"c{node_counter}"
            node_counter += 1
            name = layouts._sanitize_mermaid_label((comp.get("name") or "")[:25])
            comp_type = (comp.get("type") or "service").lower()
            icon = type_icons.get(comp_type, "📦")
            if comp_type == "database":
                lines.append(f'    {node_id}[("{icon} {name}")]')
            else:
                lines.append(f'    {node_id}["{icon} {name}"]')
            compact_layer_nodes[layer_key].append(node_id)

    # Connect User to presentation layer (or first available layer)
    first_layer = active_compact_layers[0] if active_compact_layers else None
    if first_layer and compact_layer_nodes.get(first_layer):
        for node_id in compact_layer_nodes[first_layer]:
            lines.append(f"    User --> {node_id}")

    # Connect each layer to the next — every node in current layer connects to every node in next layer
    for i in range(len(active_compact_layers) - 1):
        current_layer = active_compact_layers[i]
        next_layer = active_compact_layers[i + 1]
        current_nodes = compact_layer_nodes.get(current_layer, [])
        next_nodes = compact_layer_nodes.get(next_layer, [])
        if current_nodes and next_nodes:
            # If both layers are small, connect all-to-all; otherwise connect smartly
            if len(current_nodes) <= 3 and len(next_nodes) <= 3:
                for cn in current_nodes:
                    for nn in next_nodes:
                        lines.append(f"    {cn} --> {nn}")
            else:
                # Fan-out from each current node to first node of next layer,
                # plus last current to all next for coverage
                for cn in current_nodes:
                    lines.append(f"    {cn} --> {next_nodes[0]}")
                if len(next_nodes) > 1:
                    lines.append(f"    {current_nodes[-1]} --> {next_nodes[-1]}")

    lines.extend(layouts._get_mermaid_styles())
    versions.append({
        "code": "\n".join(lines),
        "layout": "Compact",
        "direction": "TB",
        "description": "Simplified compact view with relationships",
    })

    return versions


def _generate_lld_versions(plan: dict) -> list[dict]:
    """Generate multiple LLD layout versions (classDiagram with different directions)."""
    base_code = layouts._lld_to_mermaid(plan)
    lines = base_code.split("\n")
    rest = "\n".join(lines[1:]) if len(lines) > 1 else ""
    return [
        {"code": "classDiagram\n    direction TB\n" + rest, "layout": "Hierarchical", "direction": "TB", "description": "Top-to-bottom class view"},
        {"code": "classDiagram\n    direction LR\n" + rest, "layout": "Horizontal", "direction": "LR", "description": "Left-to-right class view"},
    ]
