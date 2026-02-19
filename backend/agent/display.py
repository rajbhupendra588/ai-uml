"""Format diagram plans for display in the UI."""
import json


def format_plan_for_display(plan: dict, diagram_type: str) -> str:
    """
    Format a diagram plan as a readable, detailed string for display in the chat panel.
    """
    lines: list[str] = []
    dt = (diagram_type or "architecture").lower()

    if dt in ("architecture", "flowchart"):
        comps = plan.get("components")
        if isinstance(comps, list) and comps:
            lines.append("Architecture components:")
            for c in comps:
                name = c.get("name") if isinstance(c, dict) else str(c)
                typ = c.get("type", "") if isinstance(c, dict) else ""
                lines.append(f"  • {name}" + (f" ({typ})" if typ else ""))
    elif dt == "hld":
        layers = plan.get("layers")
        if isinstance(layers, dict):
            for layer_name, items in layers.items():
                if isinstance(items, list) and items:
                    lines.append(f"{layer_name.title()} layer:")
                    for i in items:
                        name = i.get("name") if isinstance(i, dict) else str(i)
                        tech = i.get("tech", "") if isinstance(i, dict) else ""
                        lines.append(f"  • {name}" + (f" — {tech}" if tech else ""))
                    lines.append("")
        flows = plan.get("flows")
        if isinstance(flows, list) and flows:
            lines.append("Data flows:")
            for f in flows:
                fr, to = f.get("from", ""), f.get("to", "")
                label = f.get("label", "") if isinstance(f, dict) else ""
                if fr and to:
                    lines.append(f"  {fr} → {to}" + (f" ({label})" if label else ""))
    elif dt == "lld":
        modules = plan.get("modules", [])
        if isinstance(modules, list) and modules:
            for m in modules:
                if isinstance(m, dict):
                    name = m.get("name", "?")
                    classes = m.get("classes") or []
                    lines.append(f"{name}: {', '.join(c.get('name', '?') for c in classes if isinstance(c, dict))}")
        deps = plan.get("dependencies") or []
        if isinstance(deps, list) and deps:
            lines.append("")
            lines.append("Dependencies:")
            for d in deps:
                if isinstance(d, dict):
                    fr, to = d.get("from", ""), d.get("to", "")
                    if fr and to:
                        lines.append(f"  {fr} → {to}")
    elif dt == "mindtree":
        nodes = plan.get("nodes")
        if isinstance(nodes, list) and nodes:
            lines.append("Mind tree structure:")
            for n in nodes:
                label = n.get("label") if isinstance(n, dict) else str(n)
                pid = n.get("parentId") if isinstance(n, dict) else None
                indent = "  " if pid else ""
                lines.append(f"{indent}• {label}")
    elif dt in ("usecase", "class", "sequence", "activity", "state", "deployment"):
        if dt == "usecase":
            actors = plan.get("actors") or []
            use_cases = plan.get("useCases") or []
            if actors and isinstance(actors, list):
                names = [a.get("name", "?") for a in actors if isinstance(a, dict)]
                if names:
                    lines.append("Actors: " + ", ".join(names))
            if use_cases and isinstance(use_cases, list):
                names = [u.get("name", "?") for u in use_cases if isinstance(u, dict)]
                if names:
                    lines.append("Use cases: " + ", ".join(names))
        elif dt == "class":
            classes = plan.get("classes") or []
            if isinstance(classes, list):
                for c in classes:
                    if isinstance(c, dict):
                        lines.append(f"  • {c.get('name', '?')}")
        elif dt == "sequence":
            participants = plan.get("participants") or []
            messages = plan.get("messages") or []
            if participants and isinstance(participants, list):
                names = [p.get("name") or p.get("id", "?") for p in participants if isinstance(p, dict)]
                if names:
                    lines.append("Participants: " + ", ".join(str(n) for n in names))
            if messages and isinstance(messages, list):
                lines.append("Messages: " + str(len(messages)) + " step(s)")
        else:
            lines.append(json.dumps(plan, indent=2)[:800])
    else:
        lines.append(json.dumps(plan, indent=2)[:600])

    return "\n".join(lines).strip() or "Diagram plan ready"
