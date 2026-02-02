from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
import json
import logging
import os
import re
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("architectai.agent")

def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks and extra text."""
    if not text or not text.strip():
        raise ValueError("Empty response from LLM")
    
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to extract from markdown code blocks
    code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if code_block_match:
        try:
            return json.loads(code_block_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find JSON object pattern in text
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    raise ValueError(f"Could not extract JSON from response: {text[:200]}")

# --- State Definition ---
class AgentState(TypedDict):
    messages: List[str]
    prompt: str
    diagram_type: str
    model: str
    diagram_plan: dict
    json_output: dict

# --- LLM Setup ---
# --- LLM Setup ---
try:
    if os.getenv("OPENROUTER_API_KEY"):
        logger.info("Using OpenRouter LLM")
        llm = ChatOpenAI(
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            model=os.getenv("OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free"),
            temperature=0
        )
        has_llm = True
    elif os.getenv("OPENAI_API_KEY"):
        logger.info("Using OpenAI LLM")
        llm = ChatOpenAI(model="gpt-4-turbo", temperature=0)
        has_llm = True
    else:
        raise ValueError("No API Key")
except Exception:
    logger.warning("No valid API key (OpenAI or OpenRouter). Using mock mode.")
    llm = None
    has_llm = False

# Which LLM mode is active (for /health and debugging)
def get_llm_mode() -> str:
    if has_llm and os.getenv("OPENROUTER_API_KEY"):
        return "openrouter"
    if has_llm and os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "mock"

# --- Nodes ---
def _get_llm_for_request(model: str | None):
    """Return LLM to use: bound with selected model if OpenRouter and model given."""
    if not has_llm:
        return None
    if model and os.getenv("OPENROUTER_API_KEY"):
        return llm.bind(model=model)
    return llm


def _plan_hld(prompt: str, llm_to_use, context_str: str) -> dict:
    """Plan a detailed High-Level Design diagram."""
    
    if not has_llm:
        # Mock HLD for testing
        logger.debug("Mock HLD: generating simulated plan")
        p = prompt.lower()
        
        layers = {
            "presentation": [],
            "application": [],
            "business": [],
            "data": [],
            "external": [],
            "infrastructure": []
        }
        flows = []
        
        # Presentation Layer
        if any(w in p for w in ["web", "ui", "frontend", "portal", "dashboard"]):
            layers["presentation"].append({"name": "Web Portal", "type": "webapp", "tech": "React/Next.js"})
        if any(w in p for w in ["mobile", "app", "ios", "android"]):
            layers["presentation"].append({"name": "Mobile App", "type": "mobile", "tech": "React Native"})
        if not layers["presentation"]:
            layers["presentation"].append({"name": "Web Application", "type": "webapp", "tech": "React"})
        
        # Application Layer
        layers["application"].append({"name": "API Gateway", "type": "gateway", "tech": "Kong/nginx"})
        if any(w in p for w in ["auth", "login", "sso", "oauth"]):
            layers["application"].append({"name": "Auth Service", "type": "auth", "tech": "OAuth2/JWT"})
        
        # Business Layer
        if any(w in p for w in ["order", "cart", "checkout", "ecommerce"]):
            layers["business"].append({"name": "Order Service", "type": "service", "tech": "Node.js"})
            layers["business"].append({"name": "Inventory Service", "type": "service", "tech": "Python"})
        if any(w in p for w in ["payment", "billing", "invoice"]):
            layers["business"].append({"name": "Payment Service", "type": "service", "tech": "Java"})
        if any(w in p for w in ["notification", "email", "sms"]):
            layers["business"].append({"name": "Notification Service", "type": "service", "tech": "Go"})
        if not layers["business"]:
            layers["business"].append({"name": "Core Service", "type": "service", "tech": "Node.js"})
        
        # Data Layer
        layers["data"].append({"name": "Primary Database", "type": "database", "tech": "PostgreSQL"})
        if any(w in p for w in ["cache", "redis", "fast"]):
            layers["data"].append({"name": "Cache Layer", "type": "cache", "tech": "Redis"})
        if any(w in p for w in ["search", "elastic", "full-text"]):
            layers["data"].append({"name": "Search Engine", "type": "search", "tech": "Elasticsearch"})
        if any(w in p for w in ["queue", "async", "event", "message"]):
            layers["data"].append({"name": "Message Queue", "type": "queue", "tech": "RabbitMQ"})
        
        # External Layer
        if any(w in p for w in ["payment", "stripe", "paypal"]):
            layers["external"].append({"name": "Payment Gateway", "type": "external", "tech": "Stripe"})
        if any(w in p for w in ["email", "sendgrid", "mailgun"]):
            layers["external"].append({"name": "Email Provider", "type": "external", "tech": "SendGrid"})
        if any(w in p for w in ["storage", "s3", "file", "upload"]):
            layers["external"].append({"name": "Object Storage", "type": "external", "tech": "AWS S3"})
        
        # Infrastructure
        layers["infrastructure"].append({"name": "Load Balancer", "type": "lb", "tech": "ALB"})
        layers["infrastructure"].append({"name": "CDN", "type": "cdn", "tech": "CloudFront"})
        
        # Generate flows between layers
        flows = [
            {"from": "presentation", "to": "application", "label": "HTTPS/REST"},
            {"from": "application", "to": "business", "label": "gRPC/REST"},
            {"from": "business", "to": "data", "label": "TCP/SQL"},
            {"from": "business", "to": "external", "label": "HTTPS"},
        ]
        
        return {"layers": layers, "flows": flows, "type": "hld"}
    
    # REAL INTELLIGENCE (LLM) for HLD
    system_prompt = f"""You are a Senior Solutions Architect creating a detailed High-Level Design (HLD).
    Analyze the user's request and create a comprehensive system design.
    
    BEST PRACTICES / CONTEXT:
    - {context_str}
    
    Return ONLY a JSON object with this structure:
    {{
        "layers": {{
            "presentation": [
                {{"name": "Component Name", "type": "webapp|mobile|desktop", "tech": "Technology Stack"}}
            ],
            "application": [
                {{"name": "Component Name", "type": "gateway|auth|api", "tech": "Technology"}}
            ],
            "business": [
                {{"name": "Service Name", "type": "service", "tech": "Language/Framework"}}
            ],
            "data": [
                {{"name": "Storage Name", "type": "database|cache|queue|search", "tech": "Technology"}}
            ],
            "external": [
                {{"name": "External Service", "type": "external", "tech": "Provider"}}
            ],
            "infrastructure": [
                {{"name": "Infra Component", "type": "lb|cdn|dns|monitoring", "tech": "Technology"}}
            ]
        }},
        "flows": [
            {{"from": "layer_name", "to": "layer_name", "label": "Protocol/Method"}}
        ]
    }}
    
    Include relevant components based on the system requirements. Be specific with technology choices.
    """
    
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    try:
        response = (llm_to_use or llm).invoke(messages)
        logger.debug("HLD LLM raw response: %s", response.content[:500] if response.content else "<empty>")
        plan = _extract_json(response.content)
        plan["type"] = "hld"
    except Exception as e:
        logger.exception("HLD LLM error: %s", e)
        # Return minimal fallback
        plan = {
            "type": "hld",
            "layers": {
                "presentation": [{"name": "Web App", "type": "webapp", "tech": "React"}],
                "application": [{"name": "API Gateway", "type": "gateway", "tech": "nginx"}],
                "business": [{"name": "Core Service", "type": "service", "tech": "Node.js"}],
                "data": [{"name": "Database", "type": "database", "tech": "PostgreSQL"}],
                "external": [],
                "infrastructure": []
            },
            "flows": []
        }
    
    return plan


def planner_node(state: AgentState):
    """
    Analyzes the user prompt and produces a plan. For architecture uses components;
    for HLD uses detailed layered design; for UML types uses uml_flow.plan_uml.
    """
    prompt = state["prompt"]
    diagram_type = state.get("diagram_type") or "architecture"
    model = state.get("model") or ""
    llm_to_use = _get_llm_for_request(model) if model else _get_llm_for_request(None)

    # RAG Retrieval for architecture/HLD
    try:
        from rag import ArchitectureRetriever
        retriever = ArchitectureRetriever()
        context = retriever.search(prompt)
        context_str = "\n- ".join(context)
    except Exception:
        context_str = "No knowledge base available."

    # Route to appropriate planner
    if diagram_type == "hld":
        plan = _plan_hld(prompt, llm_to_use, context_str)
        return {"diagram_plan": plan}
    
    if diagram_type not in ("architecture", "hld"):
        from uml_flow import plan_uml
        plan = plan_uml(diagram_type, prompt, llm_to_use)
        return {"diagram_plan": plan}

    if not has_llm:
        # MOCK INTELLIGENCE (Fallback)
        logger.debug("Mock agent: generating simulated plan")
        p = prompt.lower()
        
        components = [{"name": "Load Balancer", "type": "server"}]
        
        # Identity & Onboarding
        if any(w in p for w in ["auth", "login", "onboarding", "buyer", "supplier"]):
             components.append({"name": "Identity Service", "type": "auth"})
        
        # Core Payment
        if "payment" in p:
             components.append({"name": "Payment Gateway", "type": "server"})
             components.append({"name": "Ledger Service", "type": "server"})
             
        # Billing & Invoices
        if "invoice" in p or "billing" in p:
             components.append({"name": "Invoice Engine", "type": "function"})
             
        # Compliance & Risk
        if "compliance" in p or "risk" in p or "security" in p:
             components.append({"name": "Risk Engine", "type": "shield"})
             
        # Workflows
        if "workflow" in p or "approval" in p:
             components.append({"name": "Workflow Manager", "type": "queue"})

        # Data & Reconciliation
        if any(w in p for w in ["database", "sql", "reporting", "reconciliation", "settlement"]):
             components.append({"name": "Primary DB", "type": "database"})
             components.append({"name": "Data Whse", "type": "database"})

        # Fallback if nothing specific found
        if len(components) == 1:
             components.append({"name": "API Service", "type": "server"})
        
        return {"diagram_plan": {"components": components}}

    # REAL INTELLIGENCE (LLM) for Architecture
    system_prompt = f"""You are a Senior Solutions Architect. 
    Analyze the user's request and list the necessary IT components.
    
    BEST PRACTICES / CONTEXT:
    - {context_str}
    
    Return ONLY a JSON object with a key 'components' containing a list of component names and their types.
    Possible Types: 'server', 'database', 'auth', 'balancer', 'client', 'function', 'queue'.
    
    Example: {{"components": [{{"name": "Auth", "type": "auth"}}, {{"name": "DB", "type": "database"}}]}}
    """
    
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    try:
        response = (llm_to_use or llm).invoke(messages)
        logger.debug("LLM raw response: %s", response.content[:500] if response.content else "<empty>")
        plan = _extract_json(response.content)
    except Exception as e:
        logger.exception("LLM error: %s", e)
        plan = {"components": [{"name": "Error Fallback", "type": "server"}]}
    
    return {"diagram_plan": plan}

# =============================================================================
# ENHANCED COMPONENT DETECTION
# =============================================================================

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

def _detect_component_type(name: str, explicit_type: str = None) -> dict:
    """Detect component category and type from name and explicit type."""
    name_lower = name.lower()
    explicit_lower = (explicit_type or "").lower()
    
    # First check explicit type
    if explicit_type:
        for category, config in COMPONENT_CATEGORIES.items():
            if explicit_lower == config["type"] or explicit_lower in config["keywords"]:
                return {
                    "category": category,
                    "type": config["type"],
                    "icon": config["icon"],
                    "tier": config["tier"],
                }
    
    # Then check name for keywords
    for category, config in COMPONENT_CATEGORIES.items():
        for keyword in config["keywords"]:
            if keyword in name_lower:
                return {
                    "category": category,
                    "type": config["type"],
                    "icon": config["icon"],
                    "tier": config["tier"],
                }
    
    # Default to service
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


# Tier order for layout: same type = same row, so diagrams vary by architecture
_TIER_ORDER = ("cdn", "balancer", "client", "gateway", "auth", "server", "function", "queue", "cache", "database", "search", "storage", "external", "monitoring")

def _tier_index(comp_type: str) -> int:
    t = (comp_type or "server").lower()
    for i, tier in enumerate(_TIER_ORDER):
        if tier in t or t in tier:
            return i
    return 5  # default middle tier

# =============================================================================
# LAYOUT ALGORITHMS
# =============================================================================

def _architecture_to_mermaid_tb(components: list[dict], layout_name: str = "Hierarchical") -> dict:
    """
    Generate Mermaid flowchart code for architecture diagrams - Top-to-Bottom layout.
    Returns dict with mermaid code and layout metadata.
    """
    enhanced = _enhance_components(components)
    lines = ["flowchart TD"]
    
    # Add client/entry node
    lines.append('    client(["👤 Client / Entry"])')
    
    # Group components by tier for structured layout
    by_tier: dict[int, list[dict]] = {}
    for i, comp in enumerate(enhanced):
        tier = comp.get("tier", 3)
        by_tier.setdefault(tier, []).append({**comp, "index": i})
    
    tier_order = sorted([t for t in by_tier.keys() if t >= 0])
    node_ids = []
    
    # Define nodes with appropriate shapes
    for tier in tier_order:
        items = by_tier[tier]
        for comp in items:
            node_id = f"n{comp['index']}"
            node_ids.append(node_id)
            name = _sanitize_mermaid_label(comp.get("name", "Service")[:40])
            icon = comp.get("icon", "📦")
            comp_type = comp.get("type", "server")
            label = f"{icon} {name}"
            
            # Use safe shapes based on component type
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
    
    # Connect client to first tier components
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for comp in first_tier_items:
        lines.append(f"    client --> n{comp['index']}")
    
    # Connect tiers sequentially  
    for idx in range(len(tier_order) - 1):
        current_tier = tier_order[idx]
        next_tier = tier_order[idx + 1]
        current_items = by_tier[current_tier]
        next_items = by_tier[next_tier]
        
        # Connect each item in current tier to items in next tier
        for comp in current_items:
            for next_comp in next_items:
                lines.append(f"    n{comp['index']} --> n{next_comp['index']}")
    
    # Add styling
    lines.extend(_get_mermaid_styles())
    
    # Apply styles to nodes
    for tier in tier_order:
        items = by_tier[tier]
        for comp in items:
            comp_type = comp.get("type", "server")
            if comp_type == "database":
                lines.append(f"    class n{comp['index']} database")
            elif comp_type == "auth":
                lines.append(f"    class n{comp['index']} auth")
            elif comp_type in ("queue", "cache"):
                lines.append(f"    class n{comp['index']} queue")
            elif comp_type == "gateway":
                lines.append(f"    class n{comp['index']} gateway")
    
    return {
        "code": "\n".join(lines),
        "layout": layout_name,
        "direction": "TB",
        "description": "Top-to-bottom hierarchical flow showing system tiers",
    }


def _architecture_to_mermaid_lr(components: list[dict], layout_name: str = "Horizontal") -> dict:
    """
    Generate Mermaid flowchart code - Left-to-Right layout.
    Better for showing data flow pipelines.
    """
    enhanced = _enhance_components(components)
    lines = ["flowchart LR"]
    
    # Add client/entry node
    lines.append('    client(["👤 Client"])')
    
    # Group components by tier
    by_tier: dict[int, list[dict]] = {}
    for i, comp in enumerate(enhanced):
        tier = comp.get("tier", 3)
        by_tier.setdefault(tier, []).append({**comp, "index": i})
    
    tier_order = sorted([t for t in by_tier.keys() if t >= 0])
    
    # Create subgraphs for each tier level
    tier_names = {
        0: "Entry", 1: "Gateway", 2: "Auth", 3: "Services",
        4: "Functions", 5: "Messaging", 6: "Data", 7: "External"
    }
    
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
            label = f"{icon} {name}"
            
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
    
    # Connect client to first tier
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for comp in first_tier_items:
        lines.append(f"    client --> n{comp['index']}")
    
    # Connect tiers
    for idx in range(len(tier_order) - 1):
        current_items = by_tier[tier_order[idx]]
        next_items = by_tier[tier_order[idx + 1]]
        
        # Connect first of each tier for cleaner look
        if current_items and next_items:
            lines.append(f"    n{current_items[0]['index']} --> n{next_items[0]['index']}")
            # Connect remaining in parallel if multiple
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


def _architecture_to_mermaid_grouped(components: list[dict], layout_name: str = "Grouped") -> dict:
    """
    Generate Mermaid flowchart code - Grouped by category with subgraphs.
    Best for showing logical groupings.
    """
    enhanced = _enhance_components(components)
    lines = ["flowchart TB"]
    
    # Group by category
    by_category: dict[str, list[dict]] = {}
    for i, comp in enumerate(enhanced):
        category = comp.get("category", "service")
        by_category.setdefault(category, []).append({**comp, "index": i})
    
    # Category display order and names
    category_order = ["client", "load_balancer", "cdn", "gateway", "auth", "service", "function", "queue", "cache", "database", "search", "storage", "external", "monitoring"]
    category_names = {
        "client": "Clients",
        "load_balancer": "Load Balancing",
        "cdn": "CDN Layer",
        "gateway": "API Gateway",
        "auth": "Authentication",
        "service": "Core Services",
        "function": "Serverless",
        "queue": "Message Queue",
        "cache": "Caching",
        "database": "Data Storage",
        "search": "Search",
        "storage": "Object Storage",
        "external": "External Services",
        "monitoring": "Observability",
    }
    
    # Add client entry
    lines.append('    client(["👤 Client / Entry"])')
    
    all_first_nodes = []
    all_last_nodes = []
    
    for category in category_order:
        if category not in by_category or category == "client":
            continue
        
        items = by_category[category]
        cat_name = category_names.get(category, category.title())
        
        lines.append(f"    subgraph {category}[\"{cat_name}\"]")
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
            label = f"{icon} {name}"
            
            if comp_type == "database":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type in ("queue", "cache"):
                lines.append(f'        {node_id}[["{label}"]]')
            else:
                lines.append(f'        {node_id}["{label}"]')
        
        all_last_nodes.append((category, f"n{items[-1]['index']}"))
        lines.append("    end")
    
    # Connect client to first group
    if all_first_nodes:
        lines.append(f"    client --> {all_first_nodes[0][1]}")
    
    # Connect groups sequentially
    for i in range(len(all_last_nodes) - 1):
        _, last_node = all_last_nodes[i]
        _, first_node = all_first_nodes[i + 1]
        lines.append(f"    {last_node} --> {first_node}")
    
    lines.extend(_get_mermaid_styles())
    
    # Style subgraphs
    for category in by_category.keys():
        if category != "client":
            lines.append(f"    style {category} fill:#0f172a,stroke:#334155,color:#e2e8f0")
    
    return {
        "code": "\n".join(lines),
        "layout": layout_name,
        "direction": "TB",
        "description": "Components grouped by logical category",
    }


def _get_mermaid_styles() -> list[str]:
    """Return common Mermaid styling lines."""
    return [
        "",
        "    %% Styling",
        "    classDef default fill:#334155,stroke:#64748b,color:#e2e8f0",
        "    classDef database fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd",
        "    classDef auth fill:#3f1f3f,stroke:#a855f7,color:#d8b4fe",
        "    classDef queue fill:#1f3f2f,stroke:#22c55e,color:#86efac",
        "    classDef gateway fill:#3f2f1f,stroke:#f59e0b,color:#fcd34d",
        "    classDef cache fill:#1f2f3f,stroke:#06b6d4,color:#67e8f9",
    ]


def _architecture_to_mermaid(components: list[dict]) -> str:
    """
    Generate Mermaid flowchart code for architecture diagrams.
    Uses different node shapes based on component type.
    """
    lines = ["flowchart TD"]
    
    # Add client/entry node
    lines.append('    client(["👤 Client / Entry"])')
    
    # Group components by tier for structured layout
    by_tier: dict[int, list[tuple[int, dict]]] = {}
    for i, comp in enumerate(components):
        tier = _tier_index(comp.get("type", "server"))
        by_tier.setdefault(tier, []).append((i, comp))
    
    tier_order = sorted(by_tier.keys())
    node_ids = []
    
    # Define nodes with appropriate shapes
    for tier in tier_order:
        items = by_tier[tier]
        for orig_i, comp in items:
            node_id = f"n{orig_i}"
            node_ids.append(node_id)
            name = _sanitize_mermaid_label((comp.get("name") or "Service")[:40])
            comp_type = (comp.get("type") or "server").lower()
            
            # Add type icon
            icons = {
                "database": "🗄️",
                "auth": "🔐",
                "server": "⚙️",
                "balancer": "⚖️",
                "queue": "📬",
                "function": "λ",
                "client": "👤",
            }
            icon = icons.get(comp_type, "📦")
            label = f"{icon} {name}"
            
            # Use safe shapes (avoiding problematic syntax like trapezoid, hexagon, flag)
            if comp_type == "database":
                lines.append(f'    {node_id}[("{label}")]')
            elif comp_type == "queue":
                lines.append(f'    {node_id}[["{label}"]]')
            elif comp_type in ("balancer", "client"):
                lines.append(f'    {node_id}(["{label}"])')
            else:
                lines.append(f'    {node_id}["{label}"]')
    
    # Add subgraphs for each tier
    tier_names = {
        0: "Load Balancing",
        1: "Clients", 
        2: "Authentication",
        3: "Services",
        4: "Functions",
        5: "Messaging",
        6: "Data Layer",
    }
    
    # Connect client to first tier components
    first_tier = tier_order[0] if tier_order else 3
    first_tier_items = by_tier.get(first_tier, [])
    for orig_i, _ in first_tier_items:
        lines.append(f"    client --> n{orig_i}")
    
    # Connect tiers sequentially  
    for idx in range(len(tier_order) - 1):
        current_tier = tier_order[idx]
        next_tier = tier_order[idx + 1]
        current_items = by_tier[current_tier]
        next_items = by_tier[next_tier]
        
        # Connect each item in current tier to items in next tier
        for orig_i, _ in current_items:
            for next_i, _ in next_items:
                lines.append(f"    n{orig_i} --> n{next_i}")
    
    # Add styling
    lines.append("")
    lines.append("    %% Styling")
    lines.append("    classDef default fill:#334155,stroke:#64748b,color:#e2e8f0")
    lines.append("    classDef database fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd")
    lines.append("    classDef auth fill:#3f1f3f,stroke:#a855f7,color:#d8b4fe")
    lines.append("    classDef queue fill:#1f3f2f,stroke:#22c55e,color:#86efac")
    
    # Apply styles to nodes
    for tier in tier_order:
        items = by_tier[tier]
        for orig_i, comp in items:
            comp_type = (comp.get("type") or "server").lower()
            if comp_type == "database":
                lines.append(f"    class n{orig_i} database")
            elif comp_type == "auth":
                lines.append(f"    class n{orig_i} auth")
            elif comp_type == "queue":
                lines.append(f"    class n{orig_i} queue")
    
    return "\n".join(lines)


def _sanitize_mermaid_label(text: str) -> str:
    """Sanitize text for use in Mermaid labels."""
    # Remove or replace problematic characters
    text = text.replace('"', "'")
    text = text.replace('[', '(')
    text = text.replace(']', ')')
    text = text.replace('{', '(')
    text = text.replace('}', ')')
    text = text.replace('<', '')
    text = text.replace('>', '')
    text = text.replace('\\n', ' - ')
    text = text.replace('\n', ' ')
    return text


def _hld_to_mermaid(plan: dict) -> str:
    """
    Generate a comprehensive Mermaid flowchart for High-Level Design (HLD).
    Uses subgraphs for each layer with detailed component information.
    """
    layers = plan.get("layers", {})
    flows = plan.get("flows", [])
    
    lines = ["flowchart TB"]
    
    # Layer display names and icons
    layer_config = {
        "presentation": {"name": "Presentation Layer", "icon": "🖥️"},
        "application": {"name": "Application Layer", "icon": "🔌"},
        "business": {"name": "Business Logic Layer", "icon": "⚙️"},
        "data": {"name": "Data Layer", "icon": "🗄️"},
        "external": {"name": "External Services", "icon": "🌐"},
        "infrastructure": {"name": "Infrastructure", "icon": "🏗️"},
    }
    
    # Component type icons
    type_icons = {
        "webapp": "🌐",
        "mobile": "📱",
        "desktop": "🖥️",
        "gateway": "🚪",
        "auth": "🔐",
        "api": "📡",
        "service": "⚙️",
        "database": "🗄️",
        "cache": "⚡",
        "queue": "📬",
        "search": "🔍",
        "external": "🔗",
        "lb": "⚖️",
        "cdn": "🌍",
        "dns": "📍",
        "monitoring": "📊",
    }
    
    # Track all node IDs for connections
    layer_nodes: dict[str, list[str]] = {}
    node_counter = 0
    
    # Define layer order for top-to-bottom flow
    layer_order = ["infrastructure", "presentation", "application", "business", "data", "external"]
    
    # Generate subgraphs for each layer
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
            
            # Create node with name and technology
            if tech:
                label = f"{icon} {name} - {tech}"
            else:
                label = f"{icon} {name}"
            
            # Use safe shapes based on component type (avoiding problematic syntax)
            if comp_type == "database":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type == "cache":
                lines.append(f'        {node_id}[("{label}")]')
            elif comp_type == "queue":
                lines.append(f'        {node_id}[["{label}"]]')
            elif comp_type == "gateway":
                lines.append(f'        {node_id}["{label}"]')
            elif comp_type == "auth":
                lines.append(f'        {node_id}["{label}"]')
            elif comp_type == "external":
                lines.append(f'        {node_id}["{label}"]')
            elif comp_type in ("lb", "cdn"):
                lines.append(f'        {node_id}(["{label}"])')
            else:
                lines.append(f'        {node_id}["{label}"]')
        
        lines.append("    end")
    
    lines.append("")
    lines.append("    %% Data Flows")
    
    # Add explicit flows from plan
    for flow in flows:
        from_layer = flow.get("from", "")
        to_layer = flow.get("to", "")
        label = flow.get("label", "")
        
        from_nodes = layer_nodes.get(from_layer, [])
        to_nodes = layer_nodes.get(to_layer, [])
        
        if from_nodes and to_nodes:
            # Connect first node of each layer (simplified)
            if label:
                lines.append(f'    {from_nodes[0]} -->|"{label}"| {to_nodes[0]}')
            else:
                lines.append(f"    {from_nodes[0]} --> {to_nodes[0]}")
    
    # Auto-generate flows between adjacent layers if no explicit flows
    if not flows:
        ordered_layers = [l for l in layer_order if l in layer_nodes and layer_nodes[l]]
        for i in range(len(ordered_layers) - 1):
            current = ordered_layers[i]
            next_layer = ordered_layers[i + 1]
            if current in layer_nodes and next_layer in layer_nodes:
                for from_node in layer_nodes[current]:
                    for to_node in layer_nodes[next_layer]:
                        lines.append(f"    {from_node} --> {to_node}")
                        break  # Only connect to first node in next layer
                    break  # Only connect from first node
    
    # Add styling
    lines.append("")
    lines.append("    %% Styling")
    lines.append("    classDef default fill:#334155,stroke:#64748b,color:#e2e8f0")
    lines.append("    classDef presentation fill:#4338ca,stroke:#6366f1,color:#e0e7ff")
    lines.append("    classDef application fill:#5b21b6,stroke:#8b5cf6,color:#ede9fe")
    lines.append("    classDef business fill:#1d4ed8,stroke:#3b82f6,color:#dbeafe")
    lines.append("    classDef data fill:#0e7490,stroke:#06b6d4,color:#cffafe")
    lines.append("    classDef external fill:#047857,stroke:#10b981,color:#d1fae5")
    lines.append("    classDef infrastructure fill:#475569,stroke:#94a3b8,color:#f1f5f9")
    
    # Apply styles to subgraphs
    for layer_key in layer_order:
        if layer_key in layer_nodes:
            lines.append(f"    style {layer_key} fill:#0f172a,stroke:#334155,color:#e2e8f0")
    
    return "\n".join(lines)


def _architecture_to_reactflow(components: list[dict]) -> dict:
    """
    Generate ReactFlow nodes and edges for architecture diagrams.
    Returns nodes positioned in tiers and edges with Mermaid-style data.
    Uses improved layout to prevent overlapping.
    """
    nodes = []
    edges = []
    
    # Icons for component types
    icons = {
        "database": "🗄️",
        "auth": "🔐",
        "server": "⚙️",
        "balancer": "⚖️",
        "queue": "📬",
        "function": "λ",
        "client": "👤",
    }
    
    # Group components by tier first to calculate layout
    by_tier: dict[int, list[tuple[int, dict]]] = {}
    for i, comp in enumerate(components):
        tier = _tier_index(comp.get("type", "server"))
        by_tier.setdefault(tier, []).append((i, comp))
    
    tier_order = sorted(by_tier.keys())
    
    # Calculate max items per tier for proper spacing
    max_items = max((len(items) for items in by_tier.values()), default=1)
    
    # Dynamic spacing
    node_width = 260  # Increased width
    horizontal_gap = 60
    row_height = 180  # Increased row height
    y_start = 180
    
    # Calculate canvas width
    canvas_width = max(1000, max_items * (node_width + horizontal_gap))
    
    # Root client node - centered
    nodes.append({
        "id": "client",
        "type": "hardware",
        "position": {"x": canvas_width // 2 - node_width // 2, "y": 50},
        "data": {"label": "👤 Client / Entry", "subLabel": "User Traffic"},
    })
    
    # Create nodes for each component
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
                "data": {
                    "label": f"{icon} {comp.get('name', 'Service')}",
                    "subLabel": comp_type.upper(),
                },
            })
    
    # Create edges from client to first tier
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
    
    # Create edges between tiers
    for idx in range(len(tier_order) - 1):
        current_tier = tier_order[idx]
        next_tier = tier_order[idx + 1]
        current_items = by_tier[current_tier]
        next_items = by_tier[next_tier]
        
        for orig_i, comp in current_items:
            for next_i, _ in next_items:
                edge_label = ""
                comp_type = (comp.get("type") or "server").lower()
                if comp_type == "auth":
                    edge_label = "Auth"
                elif comp_type == "server":
                    edge_label = "API"
                elif comp_type == "queue":
                    edge_label = "Async"
                
                edges.append({
                    "id": f"edge-node-{orig_i}-node-{next_i}",
                    "source": f"node-{orig_i}",
                    "target": f"node-{next_i}",
                    "animated": True,
                    "data": {"label": edge_label, "edgeType": "default"},
                })
    
    return {"nodes": nodes, "edges": edges}


def _hld_to_reactflow(plan: dict) -> dict:
    """
    Generate ReactFlow nodes and edges for HLD diagrams.
    Uses improved layout to prevent overlapping.
    """
    layers = plan.get("layers", {})
    flows = plan.get("flows", [])
    
    nodes = []
    edges = []
    
    type_icons = {
        "webapp": "🌐", "mobile": "📱", "desktop": "🖥️",
        "gateway": "🚪", "auth": "🔐", "api": "📡",
        "service": "⚙️", "database": "🗄️", "cache": "⚡",
        "queue": "📬", "search": "🔍", "external": "🔗",
        "lb": "⚖️", "cdn": "🌍", "dns": "📍", "monitoring": "📊",
    }
    
    layer_order = ["infrastructure", "presentation", "application", "business", "data", "external"]
    layer_nodes: dict[str, list[str]] = {}
    node_counter = 0
    
    # Calculate max components per layer for proper spacing
    max_components = 1
    active_layers = []
    for layer_key in layer_order:
        components = layers.get(layer_key, [])
        if components:
            active_layers.append(layer_key)
            max_components = max(max_components, len(components))
    
    # Dynamic spacing based on content
    node_width = 250  # Increased from 200
    node_height = 80
    horizontal_gap = 50  # Gap between nodes
    vertical_gap = 180  # Increased gap between layers
    
    # Calculate canvas dimensions
    canvas_width = max(1200, max_components * (node_width + horizontal_gap))
    y_start = 80
    
    # Create nodes for each active layer
    for layer_idx, layer_key in enumerate(active_layers):
        components = layers.get(layer_key, [])
        if not components:
            continue
        
        layer_nodes[layer_key] = []
        y = y_start + layer_idx * vertical_gap
        
        n = len(components)
        # Calculate total width for this row
        total_row_width = n * node_width + (n - 1) * horizontal_gap
        # Center the row
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
                "data": {
                    "label": f"{icon} {name}",
                    "subLabel": tech if tech else comp_type.upper(),
                },
            })
    
    # Create edges from flows
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
    
    # Auto-generate edges if no flows defined
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


def generator_node(state: AgentState):
    """
    Generates Mermaid diagram code from the plan.
    All diagrams are rendered using Mermaid.js for consistent, auto-layout rendering.
    Returns multiple layout versions for Architecture and HLD diagrams.
    """
    plan = state["diagram_plan"]
    diagram_type = state.get("diagram_type") or "architecture"
    logger.debug("Generating Mermaid for plan: %s, type: %s", plan, diagram_type)

    explanation = None
    
    # HLD diagram - generate multiple versions
    if diagram_type == "hld":
        versions = _generate_hld_versions(plan)
        return {"json_output": {
            "mermaid": versions[0]["code"] if versions else "",
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    # Architecture diagram - generate multiple layout versions
    if diagram_type == "architecture":
        components = plan.get("components", [])
        if not components:
            return {"json_output": {"mermaid": "", "nodes": [], "edges": [], "versions": []}}
        
        # Generate 3 layout versions
        versions = [
            _architecture_to_mermaid_tb(components, "Hierarchical"),
            _architecture_to_mermaid_lr(components, "Horizontal Flow"),
            _architecture_to_mermaid_grouped(components, "Grouped"),
        ]
        
        return {"json_output": {
            "mermaid": versions[0]["code"],  # Default to first version
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    # UML diagrams - generate Mermaid code
    from uml_flow import plan_to_mermaid
    mermaid_code = plan_to_mermaid(diagram_type, plan)
    
    # Get explanation if available (deployment diagrams)
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


def _generate_hld_versions(plan: dict) -> list[dict]:
    """Generate multiple HLD layout versions."""
    layers = plan.get("layers", {})
    flows = plan.get("flows", [])
    
    versions = []
    
    # Version 1: Standard TB layout
    versions.append({
        "code": _hld_to_mermaid(plan),
        "layout": "Layered",
        "direction": "TB",
        "description": "Standard layered architecture view",
    })
    
    # Version 2: LR layout  
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
        "webapp": "🌐", "mobile": "📱", "gateway": "🚪",
        "auth": "🔐", "service": "⚙️", "database": "🗄️",
        "cache": "⚡", "queue": "📬", "external": "🔗",
        "lb": "⚖️", "cdn": "🌍",
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
            
            name = _sanitize_mermaid_label((comp.get("name") or "Component")[:30])
            comp_type = (comp.get("type") or "service").lower()
            icon = type_icons.get(comp_type, "📦")
            label = f"{icon} {name}"
            
            lines.append(f'        {node_id}["{label}"]')
        
        lines.append("    end")
    
    # Connect layers
    for i in range(len(active_layers) - 1):
        current = active_layers[i]
        next_layer = active_layers[i + 1]
        if current in layer_nodes and next_layer in layer_nodes:
            from_node = layer_nodes[current][0]
            to_node = layer_nodes[next_layer][0]
            lines.append(f"    {from_node} --> {to_node}")
    
    lines.extend(_get_mermaid_styles())
    
    versions.append({
        "code": "\n".join(lines),
        "layout": "Pipeline",
        "direction": "LR",
        "description": "Left-to-right data flow view",
    })
    
    # Version 3: Compact grouped
    lines = ["flowchart TB"]
    lines.append('    User(["👤 Users"])')
    
    # Create simple grouped view
    node_counter = 0
    all_nodes = []
    
    for layer_key in ["presentation", "application", "business"]:
        components = layers.get(layer_key, [])
        for comp in components:
            node_id = f"c{node_counter}"
            node_counter += 1
            name = _sanitize_mermaid_label((comp.get("name") or "")[:25])
            comp_type = (comp.get("type") or "service").lower()
            icon = type_icons.get(comp_type, "📦")
            lines.append(f'    {node_id}["{icon} {name}"]')
            all_nodes.append(node_id)
    
    # Data layer as single subgraph
    data_components = layers.get("data", [])
    if data_components:
        lines.append('    subgraph DataLayer["🗄️ Data Layer"]')
        lines.append("        direction LR")
        data_nodes = []
        for comp in data_components:
            node_id = f"c{node_counter}"
            node_counter += 1
            name = _sanitize_mermaid_label((comp.get("name") or "")[:20])
            comp_type = (comp.get("type") or "database").lower()
            icon = type_icons.get(comp_type, "🗄️")
            lines.append(f'        {node_id}[("{icon} {name}")]')
            data_nodes.append(node_id)
        lines.append("    end")
        all_nodes.extend(data_nodes)
    
    # Connect User to first node
    if all_nodes:
        lines.append(f"    User --> {all_nodes[0]}")
    
    # Simple sequential connections
    for i in range(min(3, len(all_nodes) - 1)):
        lines.append(f"    {all_nodes[i]} --> {all_nodes[i+1]}")
    
    lines.extend(_get_mermaid_styles())
    
    versions.append({
        "code": "\n".join(lines),
        "layout": "Compact",
        "direction": "TB",
        "description": "Simplified compact view",
    })
    
    return versions

# --- Graph Construction ---
workflow = StateGraph(AgentState)

workflow.add_node("planner", planner_node)
workflow.add_node("generator", generator_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "generator")
workflow.add_edge("generator", END)

app = workflow.compile()

def run_agent(prompt: str, diagram_type: str = "architecture", model: str | None = None):
    inputs = {"prompt": prompt, "messages": [], "diagram_type": diagram_type, "model": model or ""}
    result = app.invoke(inputs)
    return result["json_output"]
