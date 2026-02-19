"""
Architecture/HLD/LLD/Mindtree layout and Mermaid generation helpers.
Component detection, tier ordering, and diagram code generation.
"""
import re

# Component categories with keywords for better detection
COMPONENT_CATEGORIES = {
    "load_balancer": {
        "keywords": ["load balancer", "lb", "nginx", "haproxy", "alb", "elb", "traefik", "envoy", "reverse proxy"],
        "type": "balancer",
        "icon": "⚖️",
        "tier": 0,
    },
    "cdn": {
        "keywords": ["cdn", "cloudfront", "cloudflare", "akamai", "fastly", "edge"],
        "type": "cdn",
        "icon": "🌍",
        "tier": 0,
    },
    "gateway": {
        "keywords": ["api gateway", "gateway", "kong", "apigee", "zuul", "ambassador"],
        "type": "gateway",
        "icon": "🚪",
        "tier": 1,
    },
    "auth": {
        "keywords": ["auth", "authentication", "authorization", "oauth", "jwt", "identity", "iam", "keycloak", "auth0", "okta", "sso", "login"],
        "type": "auth",
        "icon": "🔐",
        "tier": 2,
    },
    "service": {
        "keywords": ["service", "microservice", "api", "backend", "server", "application", "app"],
        "type": "server",
        "icon": "⚙️",
        "tier": 3,
    },
    "function": {
        "keywords": ["lambda", "function", "serverless", "faas", "cloud function", "azure function"],
        "type": "function",
        "icon": "λ",
        "tier": 4,
    },
    "queue": {
        "keywords": ["queue", "message", "kafka", "rabbitmq", "sqs", "pubsub", "event", "broker", "streaming", "kinesis"],
        "type": "queue",
        "icon": "📬",
        "tier": 5,
    },
    "cache": {
        "keywords": ["cache", "redis", "memcached", "elasticache", "caching"],
        "type": "cache",
        "icon": "⚡",
        "tier": 5,
    },
    "database": {
        "keywords": ["database", "db", "postgres", "mysql", "mongodb", "dynamodb", "sql", "nosql", "storage", "data store", "rds", "aurora"],
        "type": "database",
        "icon": "🗄️",
        "tier": 6,
    },
    "search": {
        "keywords": ["search", "elasticsearch", "opensearch", "solr", "algolia", "full-text"],
        "type": "search",
        "icon": "🔍",
        "tier": 6,
    },
    "storage": {
        "keywords": ["s3", "blob", "object storage", "file storage", "bucket", "gcs"],
        "type": "storage",
        "icon": "📁",
        "tier": 6,
    },
    "external": {
        "keywords": ["external", "third-party", "payment", "stripe", "paypal", "email", "sms", "twilio", "sendgrid"],
        "type": "external",
        "icon": "🔗",
        "tier": 7,
    },
    "monitoring": {
        "keywords": ["monitoring", "logging", "metrics", "prometheus", "grafana", "datadog", "newrelic", "elk", "observability"],
        "type": "monitoring",
        "icon": "📊",
        "tier": 7,
    },
    "client": {
        "keywords": ["client", "user", "browser", "mobile", "frontend", "web app", "ui"],
        "type": "client",
        "icon": "👤",
        "tier": -1,
    },
}

_TIER_ORDER = ("cdn", "balancer", "client", "gateway", "auth", "server", "function", "queue", "cache", "database", "search", "storage", "external", "monitoring")


def _detect_component_type(name: str, explicit_type: str = None) -> dict:
    """Detect component category and type from name and explicit type."""
    name_lower = name.lower()
    explicit_lower = (explicit_type or "").lower()

    if explicit_type:
        for category, config in COMPONENT_CATEGORIES.items():
            if explicit_lower == config["type"] or explicit_lower in config["keywords"]:
                return {
                    "category": category,
                    "type": config["type"],
                    "icon": config["icon"],
                    "tier": config["tier"],
                }

    for category, config in COMPONENT_CATEGORIES.items():
        for keyword in config["keywords"]:
            if keyword in name_lower:
                return {
                    "category": category,
                    "type": config["type"],
                    "icon": config["icon"],
                    "tier": config["tier"],
                }

    return {
        "category": "service",
        "type": "server",
        "icon": "⚙️",
        "tier": 3,
    }


def _enhance_components(components: list[dict]) -> list[dict]:
    """Enhance components with better type detection and metadata."""
    enhanced = []
    for comp in components:
        name = comp.get("name", "Service")
        explicit_type = comp.get("type")
        detected = _detect_component_type(name, explicit_type)
        enhanced.append({
            **comp,
            "name": name,
            "type": detected["type"],
            "category": detected["category"],
            "icon": detected["icon"],
            "tier": detected["tier"],
        })
    return enhanced


def _tier_index(comp_type: str) -> int:
    t = (comp_type or "server").lower()
    for i, tier in enumerate(_TIER_ORDER):
        if tier in t or t in tier:
            return i
    return 5


def _get_mermaid_styles() -> list[str]:
    """Return common Mermaid styling lines. Empty so diagram color/theme are not overridden."""
    return []


def _sanitize_mermaid_label(text: str) -> str:
    """Sanitize text for use in Mermaid labels so stadium/rectangle shapes parse correctly.
    Avoids \"])\" (STADIUMEND) and other delimiter sequences that break the parser."""
    if not text:
        return ""
    text = str(text).strip()
    text = text.replace("&", " and ")
    text = text.replace('"', "'")  # no double-quote inside ["..."] labels
    text = text.replace("]", " ").replace("[", " ")  # no brackets - ]) closes stadium
    text = text.replace(")", " ").replace("(", " ")  # no parens - ) can trigger STADIUMEND
    text = text.replace("{", " ").replace("}", " ")
    text = text.replace("<", "").replace(">", "")
    text = text.replace("\\n", " - ").replace("\n", " ")
    text = text.replace('"]', " ").replace('")', " ")
    # strip any stray "])" so STADIUMEND is never triggered inside the label
    text = text.replace('"])', " ")
    return text.strip() or " "


def _format_code_for_mermaid(code: str | None, level: str = "small") -> str:
    """Format code for Mermaid node labels. NO HTML entities."""
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
    text = text.replace("&", " and ")
    text = text.replace('"', "'")
    text = text.replace("[", " ").replace("]", " ")
    text = text.replace(")", " ").replace("(", " ")
    text = text.replace("{", " ").replace("}", " ")
    text = re.sub(r"-{2,}", "-", text)
    text = text.replace("\n", "<br/>")
    return text


def _architecture_to_mermaid_tb(components: list[dict], layout_name: str = "Hierarchical", code_detail_level: str = "small") -> dict:
    """Generate Mermaid flowchart code for architecture diagrams - Top-to-Bottom layout."""
    enhanced = _enhance_components(components)
    lines = ["flowchart TD"]
    lines.append('    client(["👤 Client / Entry"])')
    by_tier: dict[int, list[dict]] = {}
    for i, comp in enumerate(enhanced):
        tier = comp.get("tier", 3)
        by_tier.setdefault(tier, []).append({**comp, "index": i})
    tier_order = sorted([t for t in by_tier.keys() if t >= 0])
    node_ids = []
    for tier in tier_order:
        items = by_tier[tier]
        for comp in items:
            node_id = f"n{comp['index']}"
            node_ids.append(node_id)
            name = _sanitize_mermaid_label(comp.get("name", "Service")[:40])
            icon = comp.get("icon", "📦")
            comp_type = comp.get("type", "server")
            code_block = comp.get("code") or comp.get("snippet")
            code_fmt = _format_code_for_mermaid(code_block, code_detail_level) if code_block else ""
            label = f"{icon} {name}" + (f"<br/>{code_fmt}" if code_fmt else "")
            if comp_type == "database":
                lines.append(f'    {node_id}[("{label}")]')
            elif comp_type in ("queue", "cache"):
                lines.append(f'    {node_id}[["{label}"]]')
            elif comp_type in ("balancer", "client", "cdn"):
                lines.append(f'    {node_id}(["{label}"])')
            elif comp_type == "gateway":
                lines.append(f'    {node_id}{{{{"{label}"}}}}')
            else:
                lines.append(f'    {node_id}["{label}"]')
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for comp in first_tier_items:
        lines.append(f"    client --> n{comp['index']}")
    for idx in range(len(tier_order) - 1):
        current_tier = tier_order[idx]
        next_tier = tier_order[idx + 1]
        current_items = by_tier[current_tier]
        next_items = by_tier[next_tier]
        for comp in current_items:
            for next_comp in next_items:
                lines.append(f"    n{comp['index']} --> n{next_comp['index']}")
    lines.extend(_get_mermaid_styles())
    return {
        "code": "\n".join(lines),
        "layout": layout_name,
        "direction": "TB",
        "description": "Top-to-bottom hierarchical flow showing system tiers",
    }


def _architecture_to_mermaid_lr(components: list[dict], layout_name: str = "Horizontal", code_detail_level: str = "small") -> dict:
    """Generate Mermaid flowchart code - Left-to-Right layout."""
    enhanced = _enhance_components(components)
    lines = ["flowchart LR"]
    lines.append('    client(["👤 Client"])')
    by_tier: dict[int, list[dict]] = {}
    for i, comp in enumerate(enhanced):
        tier = comp.get("tier", 3)
        by_tier.setdefault(tier, []).append({**comp, "index": i})
    tier_order = sorted([t for t in by_tier.keys() if t >= 0])
    tier_names = {0: "Entry", 1: "Gateway", 2: "Auth", 3: "Services", 4: "Functions", 5: "Messaging", 6: "Data", 7: "External"}
    for tier in tier_order:
        items = by_tier[tier]
        tier_name = tier_names.get(tier, f"Tier{tier}")
        if len(items) > 1:
            lines.append(f"    subgraph {tier_name}")
            lines.append("        direction TB")
        for comp in items:
            node_id = f"n{comp['index']}"
            name = _sanitize_mermaid_label(comp.get("name", "Service")[:35])
            icon = comp.get("icon", "📦")
            comp_type = comp.get("type", "server")
            code_block = comp.get("code") or comp.get("snippet")
            code_fmt = _format_code_for_mermaid(code_block, code_detail_level) if code_block else ""
            label = f"{icon} {name}" + (f"<br/>{code_fmt}" if code_fmt else "")
            if comp_type == "database":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type in ("queue", "cache"):
                lines.append(f'        {node_id}[["{label}"]]')
            elif comp_type in ("balancer", "cdn"):
                lines.append(f'        {node_id}(["{label}"])')
            else:
                lines.append(f'        {node_id}["{label}"]')
        if len(items) > 1:
            lines.append("    end")
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for comp in first_tier_items:
        lines.append(f"    client --> n{comp['index']}")
    for idx in range(len(tier_order) - 1):
        current_items = by_tier[tier_order[idx]]
        next_items = by_tier[tier_order[idx + 1]]
        if current_items and next_items:
            lines.append(f"    n{current_items[0]['index']} --> n{next_items[0]['index']}")
            if len(current_items) > 1 and len(next_items) > 1:
                for comp in current_items[1:]:
                    for next_comp in next_items[1:]:
                        lines.append(f"    n{comp['index']} -.-> n{next_comp['index']}")
    lines.extend(_get_mermaid_styles())
    return {
        "code": "\n".join(lines),
        "layout": layout_name,
        "direction": "LR",
        "description": "Left-to-right flow showing data pipeline progression",
    }


def _architecture_to_mermaid_grouped(components: list[dict], layout_name: str = "Grouped", code_detail_level: str = "small") -> dict:
    """Generate Mermaid flowchart code - Grouped by category with subgraphs."""
    enhanced = _enhance_components(components)
    lines = ["flowchart TB"]
    by_category: dict[str, list[dict]] = {}
    for i, comp in enumerate(enhanced):
        category = comp.get("category", "service")
        by_category.setdefault(category, []).append({**comp, "index": i})
    category_order = ["client", "load_balancer", "cdn", "gateway", "auth", "service", "function", "queue", "cache", "database", "search", "storage", "external", "monitoring"]
    category_names = {
        "client": "Clients", "load_balancer": "Load Balancing", "cdn": "CDN Layer", "gateway": "API Gateway",
        "auth": "Authentication", "service": "Core Services", "function": "Serverless", "queue": "Message Queue",
        "cache": "Caching", "database": "Data Storage", "search": "Search", "storage": "Object Storage",
        "external": "External Services", "monitoring": "Observability",
    }
    lines.append('    client(["👤 Client / Entry"])')
    all_first_nodes = []
    all_last_nodes = []
    for category in category_order:
        if category not in by_category or category == "client":
            continue
        items = by_category[category]
        cat_name = category_names.get(category, category.title())
        lines.append(f'    subgraph {category}["{cat_name}"]')
        lines.append("        direction LR")
        first_node = None
        for comp in items:
            node_id = f"n{comp['index']}"
            if first_node is None:
                first_node = node_id
                all_first_nodes.append((category, node_id))
            name = _sanitize_mermaid_label(comp.get("name", "Service")[:35])
            icon = comp.get("icon", "📦")
            comp_type = comp.get("type", "server")
            code_block = comp.get("code") or comp.get("snippet")
            code_fmt = _format_code_for_mermaid(code_block, code_detail_level) if code_block else ""
            label = f"{icon} {name}" + (f"<br/>{code_fmt}" if code_fmt else "")
            if comp_type == "database":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type in ("queue", "cache"):
                lines.append(f'        {node_id}[["{label}"]]')
            else:
                lines.append(f'        {node_id}["{label}"]')
        all_last_nodes.append((category, f"n{items[-1]['index']}"))
        lines.append("    end")
    if all_first_nodes:
        lines.append(f"    client --> {all_first_nodes[0][1]}")
    for i in range(len(all_last_nodes) - 1):
        _, last_node = all_last_nodes[i]
        _, first_node = all_first_nodes[i + 1]
        lines.append(f"    {last_node} --> {first_node}")
    lines.extend(_get_mermaid_styles())
    return {
        "code": "\n".join(lines),
        "layout": layout_name,
        "direction": "TB",
        "description": "Components grouped by logical category",
    }


def _architecture_to_mermaid(components: list[dict]) -> str:
    """Legacy: single Mermaid flowchart for architecture (no versions)."""
    lines = ["flowchart TD"]
    lines.append('    client(["👤 Client / Entry"])')
    by_tier: dict[int, list[tuple[int, dict]]] = {}
    for i, comp in enumerate(components):
        tier = _tier_index(comp.get("type", "server"))
        by_tier.setdefault(tier, []).append((i, comp))
    tier_order = sorted(by_tier.keys())
    node_ids = []
    icons = {"database": "🗄️", "auth": "🔐", "server": "⚙️", "balancer": "⚖️", "queue": "📬", "function": "λ", "client": "👤"}
    for tier in tier_order:
        items = by_tier[tier]
        for orig_i, comp in items:
            node_id = f"n{orig_i}"
            node_ids.append(node_id)
            name = _sanitize_mermaid_label((comp.get("name") or "Service")[:40])
            comp_type = (comp.get("type") or "server").lower()
            icon = icons.get(comp_type, "📦")
            label = f"{icon} {name}"
            if comp_type == "database":
                lines.append(f'    {node_id}[("{label}")]')
            elif comp_type == "queue":
                lines.append(f'    {node_id}[["{label}"]]')
            elif comp_type in ("balancer", "client"):
                lines.append(f'    {node_id}(["{label}"])')
            else:
                lines.append(f'    {node_id}["{label}"]')
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for orig_i, _ in first_tier_items:
        lines.append(f"    client --> n{orig_i}")
    for idx in range(len(tier_order) - 1):
        current_tier = tier_order[idx]
        next_tier = tier_order[idx + 1]
        current_items = by_tier[current_tier]
        next_items = by_tier[next_tier]
        for orig_i, _ in current_items:
            for next_i, _ in next_items:
                lines.append(f"    n{orig_i} --> n{next_i}")
    return "\n".join(lines)


def _mindtree_to_mermaid(plan: dict) -> str:
    """Generate Mermaid mindmap from plan (nodes with id, label, parentId)."""
    nodes = plan.get("nodes", [])
    if not nodes:
        return "mindmap\n  ((Central Idea))"
    by_id: dict[str, dict] = {}
    children: dict[str | None, list[dict]] = {None: []}
    for n in nodes:
        if not isinstance(n, dict):
            continue
        nid = (n.get("id") or "").strip()
        if not nid:
            continue
        by_id[nid] = n
        pid = n.get("parentId")
        if pid is None:
            children.setdefault(None, []).append(n)
        else:
            parent_str = (pid if isinstance(pid, str) else str(pid)).strip()
            children.setdefault(parent_str, []).append(n)

    def sanitize_mindmap_label(s: str) -> str:
        t = _sanitize_mermaid_label((s or "").strip()[:60])
        return t.replace("))", ") ").replace("((", "( ").strip() or "Branch"

    def emit_tree(parent_id: str | None, depth: int) -> list[str]:
        out: list[str] = []
        for child in children.get(parent_id, []):
            label = sanitize_mindmap_label(child.get("label") or child.get("id") or "Node")
            indent = "  " * (depth + 1)
            cid = (child.get("id") or "").strip()
            if depth == 0 and parent_id is None:
                out.append(f"{indent}(({label}))")
            else:
                out.append(f"{indent}({label})")
            out.extend(emit_tree(cid, depth + 1))
        return out

    roots = children.get(None, [])
    if not roots and by_id:
        first_id = next(iter(by_id))
        roots = [by_id[first_id]]
    lines = ["mindmap"]
    if not roots:
        lines.append("  ((Central Idea))")
    else:
        for root in roots:
            root_label = sanitize_mindmap_label(root.get("label") or root.get("id") or "Central Idea")
            lines.append(f"  (({root_label}))")
            lines.extend(emit_tree((root.get("id") or "").strip(), 1))
    return "\n".join(lines)


def _mindtree_to_mermaid_tidy(plan: dict) -> str:
    """Same as _mindtree_to_mermaid but with tidy-tree layout."""
    body = _mindtree_to_mermaid(plan)
    if body.startswith("mindmap"):
        return "---\nconfig:\n  layout: tidy-tree\n---\n" + body
    return body


def _hld_to_mermaid(plan: dict, code_detail_level: str = "small") -> str:
    """Generate Mermaid flowchart for High-Level Design (HLD)."""
    layers = plan.get("layers", {})
    flows = plan.get("flows", [])
    lines = ["flowchart TB"]
    layer_config = {
        "presentation": {"name": "Presentation Layer", "icon": "🖥️"},
        "application": {"name": "Application Layer", "icon": "🔌"},
        "business": {"name": "Business Logic Layer", "icon": "⚙️"},
        "data": {"name": "Data Layer", "icon": "🗄️"},
        "external": {"name": "External Services", "icon": "🌐"},
        "infrastructure": {"name": "Infrastructure", "icon": "🏗️"},
    }
    type_icons = {
        "webapp": "🌐", "mobile": "📱", "desktop": "🖥️", "gateway": "🚪", "auth": "🔐", "api": "📡",
        "service": "⚙️", "database": "🗄️", "cache": "⚡", "queue": "📬", "search": "🔍", "external": "🔗",
        "lb": "⚖️", "cdn": "🌍", "dns": "📍", "monitoring": "📊",
    }
    layer_nodes: dict[str, list[str]] = {}
    node_counter = 0
    layer_order = ["infrastructure", "presentation", "application", "business", "data", "external"]
    for layer_key in layer_order:
        components = layers.get(layer_key, [])
        if not components:
            continue
        config = layer_config.get(layer_key, {"name": layer_key.title(), "icon": "📦"})
        layer_nodes[layer_key] = []
        lines.append("")
        lines.append(f"    subgraph {layer_key}[\"{config['icon']} {config['name']}\"]")
        lines.append("        direction LR")
        for comp in components:
            node_id = f"n{node_counter}"
            node_counter += 1
            layer_nodes[layer_key].append(node_id)
            name = _sanitize_mermaid_label((comp.get("name") or "Component")[:35])
            tech = _sanitize_mermaid_label((comp.get("tech") or "")[:20])
            comp_type = (comp.get("type") or "service").lower()
            icon = type_icons.get(comp_type, "📦")
            label = f"{icon} {name} - {tech}" if tech else f"{icon} {name}"
            code_block = comp.get("code") or comp.get("snippet")
            if code_block:
                code_fmt = _format_code_for_mermaid(code_block, code_detail_level)
                if code_fmt:
                    label = f"{label}<br/>{code_fmt}"
            if comp_type == "database":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type == "cache":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type == "queue":
                lines.append(f'        {node_id}[["{label}"]]')
            elif comp_type in ("lb", "cdn"):
                lines.append(f'        {node_id}(["{label}"])')
            else:
                lines.append(f'        {node_id}["{label}"]')
        lines.append("    end")
    lines.append("")
    lines.append("    %% Data Flows")
    for flow in flows:
        from_layer = flow.get("from", "")
        to_layer = flow.get("to", "")
        label = flow.get("label", "")
        from_nodes = layer_nodes.get(from_layer, [])
        to_nodes = layer_nodes.get(to_layer, [])
        if from_nodes and to_nodes:
            if label:
                lines.append(f'    {from_nodes[0]} -->|"{label}"| {to_nodes[0]}')
            else:
                lines.append(f"    {from_nodes[0]} --> {to_nodes[0]}")
    if not flows:
        ordered_layers = [l for l in layer_order if l in layer_nodes and layer_nodes[l]]
        for i in range(len(ordered_layers) - 1):
            current = ordered_layers[i]
            next_layer = ordered_layers[i + 1]
            if current in layer_nodes and next_layer in layer_nodes:
                for from_node in layer_nodes[current]:
                    for to_node in layer_nodes[next_layer]:
                        lines.append(f"    {from_node} --> {to_node}")
                        break
                    break
    return "\n".join(lines)


def _safe_class_id(name: str) -> str:
    """Mermaid-safe class id: alphanumeric and underscore only."""
    s = (str(name) if name else "").strip().replace("-", "_").replace(" ", "_")
    return "".join(c if c.isalnum() or c == "_" else "_" for c in s)[:30] or "C"


def _lld_to_mermaid(plan: dict) -> str:
    """Generate Mermaid classDiagram for Low-Level Design."""
    modules = plan.get("modules", [])
    dependencies = plan.get("dependencies", [])
    if not modules:
        return "classDiagram\n    class Empty[\"No modules\"]"
    lines = ["classDiagram"]
    module_to_classes: dict[str, list[str]] = {}
    all_class_ids: set[str] = set()
    for mod in modules:
        mod_name = (mod.get("name") or "Module").strip()[:40]
        mod_id = _safe_class_id(mod_name)
        module_to_classes[mod_name] = []
        for iface in mod.get("interfaces") or []:
            iname = (iface.get("name") or "I").strip()[:40]
            cid = _safe_class_id(f"{mod_id}_{iname}")
            if cid in all_class_ids:
                cid = f"{cid}_{len(all_class_ids)}"
            all_class_ids.add(cid)
            module_to_classes[mod_name].append(cid)
            imethods = iface.get("methods") or []
            lines.append(f'    class {cid} {{')
            lines.append("        <<interface>>")
            for m in imethods[:5]:
                lines.append(f"        +{str(m)[:40]}")
            lines.append("    }")
        for cls in mod.get("classes") or []:
            cname = (cls.get("name") or "Class").strip()[:40]
            cid = _safe_class_id(f"{mod_id}_{cname}")
            if cid in all_class_ids:
                cid = f"{cid}_{len(all_class_ids)}"
            all_class_ids.add(cid)
            module_to_classes[mod_name].append(cid)
            attrs = cls.get("attributes") or []
            methods = cls.get("methods") or []
            lines.append(f'    class {cid} {{')
            for a in attrs[:5]:
                lines.append(f"        +{str(a)[:45]}")
            for m in methods[:5]:
                lines.append(f"        +{str(m)[:45]}")
            lines.append("    }")
    for dep in dependencies:
        fr_mod = (dep.get("from") or "").strip()
        to_mod = (dep.get("to") or "").strip()
        dep_type = (dep.get("type") or "uses").strip().lower()
        label = (dep.get("label") or "").strip()[:30]
        fr_classes = module_to_classes.get(fr_mod, [])
        to_classes = module_to_classes.get(to_mod, [])
        if fr_classes and to_classes:
            src, tgt = fr_classes[0], to_classes[0]
            if dep_type == "implements":
                lines.append(f"    {src} ..|> {tgt}")
            elif dep_type == "extends":
                lines.append(f"    {src} --|> {tgt}")
            elif label:
                lines.append(f'    {src} --> {tgt} : "{label}"')
            else:
                lines.append(f"    {src} --> {tgt}")
    return "\n".join(lines)


def _architecture_to_reactflow(components: list[dict]) -> dict:
    """Generate ReactFlow nodes and edges for architecture diagrams."""
    nodes = []
    edges = []
    icons = {"database": "🗄️", "auth": "🔐", "server": "⚙️", "balancer": "⚖️", "queue": "📬", "function": "λ", "client": "👤"}
    by_tier: dict[int, list[tuple[int, dict]]] = {}
    for i, comp in enumerate(components):
        tier = _tier_index(comp.get("type", "server"))
        by_tier.setdefault(tier, []).append((i, comp))
    tier_order = sorted(by_tier.keys())
    max_items = max((len(items) for items in by_tier.values()), default=1)
    node_width = 260
    horizontal_gap = 60
    row_height = 180
    y_start = 180
    canvas_width = max(1000, max_items * (node_width + horizontal_gap))
    nodes.append({
        "id": "client",
        "type": "hardware",
        "position": {"x": canvas_width // 2 - node_width // 2, "y": 50},
        "data": {"label": "👤 Client / Entry", "subLabel": "User Traffic"},
    })
    for row_idx, tier in enumerate(tier_order):
        items = by_tier[tier]
        n = len(items)
        total_row_width = n * node_width + (n - 1) * horizontal_gap
        x_start = (canvas_width - total_row_width) // 2
        y = y_start + row_idx * row_height
        for col_idx, (orig_i, comp) in enumerate(items):
            node_id = f"node-{orig_i}"
            x = x_start + col_idx * (node_width + horizontal_gap)
            comp_type = (comp.get("type") or "server").lower()
            icon = icons.get(comp_type, "📦")
            nodes.append({
                "id": node_id,
                "type": "hardware",
                "position": {"x": x, "y": y},
                "data": {"label": f"{icon} {comp.get('name', 'Service')}", "subLabel": comp_type.upper()},
            })
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for orig_i, _ in first_tier_items:
        edges.append({
            "id": f"edge-client-node-{orig_i}",
            "source": "client",
            "target": f"node-{orig_i}",
            "animated": True,
            "data": {"label": "Request", "edgeType": "default"},
        })
    for idx in range(len(tier_order) - 1):
        current_tier = tier_order[idx]
        next_tier = tier_order[idx + 1]
        current_items = by_tier[current_tier]
        next_items = by_tier[next_tier]
        for orig_i, comp in current_items:
            for next_i, _ in next_items:
                comp_type = (comp.get("type") or "server").lower()
                edge_label = "Auth" if comp_type == "auth" else ("API" if comp_type == "server" else ("Async" if comp_type == "queue" else ""))
                edges.append({
                    "id": f"edge-node-{orig_i}-node-{next_i}",
                    "source": f"node-{orig_i}",
                    "target": f"node-{next_i}",
                    "animated": True,
                    "data": {"label": edge_label, "edgeType": "default"},
                })
    return {"nodes": nodes, "edges": edges}


def _hld_to_reactflow(plan: dict) -> dict:
    """Generate ReactFlow nodes and edges for HLD diagrams."""
    layers = plan.get("layers", {})
    flows = plan.get("flows", [])
    nodes = []
    edges = []
    type_icons = {
        "webapp": "🌐", "mobile": "📱", "desktop": "🖥️", "gateway": "🚪", "auth": "🔐", "api": "📡",
        "service": "⚙️", "database": "🗄️", "cache": "⚡", "queue": "📬", "search": "🔍", "external": "🔗",
        "lb": "⚖️", "cdn": "🌍", "dns": "📍", "monitoring": "📊",
    }
    layer_order = ["infrastructure", "presentation", "application", "business", "data", "external"]
    layer_nodes: dict[str, list[str]] = {}
    node_counter = 0
    max_components = 1
    active_layers = []
    for layer_key in layer_order:
        components = layers.get(layer_key, [])
        if components:
            active_layers.append(layer_key)
            max_components = max(max_components, len(components))
    node_width = 250
    node_height = 80
    horizontal_gap = 50
    vertical_gap = 180
    canvas_width = max(1200, max_components * (node_width + horizontal_gap))
    y_start = 80
    for layer_idx, layer_key in enumerate(active_layers):
        components = layers.get(layer_key, [])
        if not components:
            continue
        layer_nodes[layer_key] = []
        y = y_start + layer_idx * vertical_gap
        n = len(components)
        total_row_width = n * node_width + (n - 1) * horizontal_gap
        x_start = (canvas_width - total_row_width) // 2
        for i, comp in enumerate(components):
            node_id = f"hld-{node_counter}"
            node_counter += 1
            layer_nodes[layer_key].append(node_id)
            comp_type = (comp.get("type") or "service").lower()
            icon = type_icons.get(comp_type, "📦")
            name = comp.get("name", "Component")
            tech = comp.get("tech", "")
            x = x_start + i * (node_width + horizontal_gap)
            nodes.append({
                "id": node_id,
                "type": "hardware",
                "position": {"x": x, "y": y},
                "data": {"label": f"{icon} {name}", "subLabel": tech if tech else comp_type.upper()},
            })
    for flow in flows:
        from_layer = flow.get("from", "")
        to_layer = flow.get("to", "")
        label = flow.get("label", "")
        from_nodes_list = layer_nodes.get(from_layer, [])
        to_nodes_list = layer_nodes.get(to_layer, [])
        if from_nodes_list and to_nodes_list:
            edges.append({
                "id": f"edge-{from_nodes_list[0]}-{to_nodes_list[0]}",
                "source": from_nodes_list[0],
                "target": to_nodes_list[0],
                "animated": True,
                "data": {"label": label, "edgeType": "default"},
            })
    if not flows:
        ordered_layers = [l for l in layer_order if l in layer_nodes and layer_nodes[l]]
        for i in range(len(ordered_layers) - 1):
            current = ordered_layers[i]
            next_layer = ordered_layers[i + 1]
            if current in layer_nodes and next_layer in layer_nodes:
                for from_node in layer_nodes[current]:
                    for to_node in layer_nodes[next_layer]:
                        edges.append({
                            "id": f"edge-{from_node}-{to_node}",
                            "source": from_node,
                            "target": to_node,
                            "animated": True,
                            "data": {"label": "", "edgeType": "default"},
                        })
    return {"nodes": nodes, "edges": edges}
