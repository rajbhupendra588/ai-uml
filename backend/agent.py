from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
import json
import logging
import os
import re
from dotenv import load_dotenv

from diagram_validator import validate_and_repair, get_valid_plan

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


def _validate_and_retry(
    diagram_type: str,
    plan: dict,
    prompt: str,
    llm_to_use,
    fix_system_hint: str,
) -> tuple[dict, bool, bool]:
    """
    Validate diagram plan; if invalid, attempt one LLM retry with error feedback.
    Returns (final_plan, validation_passed, retry_used).
    """
    result = validate_and_repair(diagram_type, plan)
    if result.is_valid:
        logger.info(
            "Diagram validation passed",
            extra={"diagram_type": diagram_type, "retry_used": False},
        )
        return (plan, True, False)

    # One retry with fix prompt
    if llm_to_use and result.errors:
        try:
            fix_prompt = f"""The following JSON failed validation. Return ONLY the corrected JSON, no markdown or explanation.

Validation errors:
{chr(10).join('- ' + e for e in result.errors[:8])}

Current (invalid) JSON:
{json.dumps(plan, indent=2)[:2000]}

User's original request: {prompt[:300]}

{fix_system_hint}"""
            messages = [
                SystemMessage(content="You fix JSON to satisfy the validation errors. Output ONLY valid JSON."),
                HumanMessage(content=fix_prompt),
            ]
            response = llm_to_use.invoke(messages)
            retry_plan = _extract_json(response.content)
            retry_result = validate_and_repair(diagram_type, retry_plan)
            if retry_result.is_valid:
                logger.info(
                    "Diagram validation passed after retry",
                    extra={"diagram_type": diagram_type, "retry_used": True},
                )
                return (retry_plan, True, True)
        except Exception as e:
            logger.warning("Validation retry failed: %s", e, extra={"diagram_type": diagram_type})

    final = get_valid_plan(diagram_type, plan)
    logger.info(
        "Diagram plan used repaired/fallback",
        extra={"diagram_type": diagram_type, "errors": result.errors[:3]},
    )
    return (final, False, True)


# --- State Definition ---
class AgentState(TypedDict):
    messages: List[str]
    prompt: str
    diagram_type: str
    model: str
    diagram_plan: dict
    json_output: dict
    code_detail_level: str  # "small" | "complete"

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
        # Repository analysis mode: do not add generic AWS/cloud components
        is_repo_analysis = "repository analysis" in p or ("repository:" in p and "owner/" in p)
        
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
        if is_repo_analysis and any(w in p for w in ["rails", "ruby", "gemfile"]):
            layers["presentation"].append({"name": "Web UI", "type": "webapp", "tech": "Rails/ERB"})
        elif any(w in p for w in ["web", "ui", "frontend", "portal", "dashboard"]):
            layers["presentation"].append({"name": "Web Portal", "type": "webapp", "tech": "React/Next.js"})
        if any(w in p for w in ["mobile", "app", "ios", "android"]) and not is_repo_analysis:
            layers["presentation"].append({"name": "Mobile App", "type": "mobile", "tech": "React Native"})
        if not layers["presentation"]:
            layers["presentation"].append({"name": "Web Application", "type": "webapp", "tech": "React"})
        
        # Application Layer
        if not is_repo_analysis:
            layers["application"].append({"name": "API Gateway", "type": "gateway", "tech": "Kong/nginx"})
        if any(w in p for w in ["auth", "login", "sso", "oauth"]):
            layers["application"].append({"name": "Auth Service", "type": "auth", "tech": "OAuth2/JWT"})
        
        # Business Layer
        if is_repo_analysis and any(w in p for w in ["rails", "ruby", "gemfile"]):
            layers["business"].append({"name": "Rails Application", "type": "service", "tech": "Ruby on Rails"})
        elif any(w in p for w in ["order", "cart", "checkout", "ecommerce"]):
            layers["business"].append({"name": "Order Service", "type": "service", "tech": "Node.js"})
            layers["business"].append({"name": "Inventory Service", "type": "service", "tech": "Python"})
        elif any(w in p for w in ["payment", "billing", "invoice"]):
            layers["business"].append({"name": "Payment Service", "type": "service", "tech": "Java"})
        elif any(w in p for w in ["notification", "email", "sms"]):
            layers["business"].append({"name": "Notification Service", "type": "service", "tech": "Go"})
        if not layers["business"]:
            layers["business"].append({"name": "Core Service", "type": "service", "tech": "Node.js"})
        
        # Data Layer
        if is_repo_analysis:
            if any(w in p for w in ["sqlite", "postgres", "postgresql", "database", "db", "gemfile", "rails", "activerecord"]):
                layers["data"].append({"name": "Database", "type": "database", "tech": "SQLite/PostgreSQL"})
        else:
            layers["data"].append({"name": "Primary Database", "type": "database", "tech": "PostgreSQL"})
            if any(w in p for w in ["cache", "redis", "fast"]):
                layers["data"].append({"name": "Cache Layer", "type": "cache", "tech": "Redis"})
            if any(w in p for w in ["search", "elastic", "full-text"]):
                layers["data"].append({"name": "Search Engine", "type": "search", "tech": "Elasticsearch"})
            if any(w in p for w in ["queue", "async", "event", "message"]):
                layers["data"].append({"name": "Message Queue", "type": "queue", "tech": "RabbitMQ"})
        
        # External Layer - only if explicitly in prompt (not for repo analysis)
        if not is_repo_analysis:
            if any(w in p for w in ["payment", "stripe", "paypal"]):
                layers["external"].append({"name": "Payment Gateway", "type": "external", "tech": "Stripe"})
            if any(w in p for w in ["email", "sendgrid", "mailgun"]):
                layers["external"].append({"name": "Email Provider", "type": "external", "tech": "SendGrid"})
            if any(w in p for w in ["storage", "s3", "file", "upload"]):
                layers["external"].append({"name": "Object Storage", "type": "external", "tech": "AWS S3"})
        
        # Infrastructure - minimal for repo analysis
        if not is_repo_analysis:
            layers["infrastructure"].append({"name": "Load Balancer", "type": "lb", "tech": "ALB"})
            layers["infrastructure"].append({"name": "CDN", "type": "cdn", "tech": "CloudFront"})
        elif any(w in p for w in ["heroku", "deploy"]):
            layers["infrastructure"].append({"name": "Heroku", "type": "lb", "tech": "Heroku"})
        
        # Generate flows between layers
        flows = [
            {"from": "presentation", "to": "application", "label": "HTTPS/REST"},
            {"from": "application", "to": "business", "label": "gRPC/REST"},
            {"from": "business", "to": "data", "label": "TCP/SQL"},
            {"from": "business", "to": "external", "label": "HTTPS"},
        ]
        
        return {"layers": layers, "flows": flows, "type": "hld"}
    
    # REAL INTELLIGENCE (LLM) for HLD
    is_repo_input = "repository analysis" in prompt.lower() or ("repository:" in prompt.lower() and "owner/" in prompt.lower())
    repo_instruction = ""
    if is_repo_input:
        repo_instruction = (
            "\n\nCRITICAL - This is repository analysis: Include ONLY components that are explicitly "
            "in the codebase (Gemfile, package.json, config files, README). Do NOT add AWS, GCP, "
            "Stripe, SendGrid, SQS, Redis, etc. unless they appear in the files. A simple Ruby/Node "
            "app with Heroku = just Web app + Database + Heroku."
        )
        if "monorepo" in prompt.lower():
            repo_instruction += (
                " MONOREPO: Include ALL projects (apps/*, packages/*). Each app and shared package "
                "must appear as a component. Do not merge or omit any project."
            )
    system_prompt = f"""You are a Senior Solutions Architect creating a detailed High-Level Design (HLD). Analyze the user's request and create a comprehensive system design.

BEST PRACTICES / CONTEXT:
- {context_str}
{repo_instruction}

Output ONLY a valid JSON object. No markdown, no code fences, no explanation.
Required structure:
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
    Optional: Add "code" or "snippet" (string, 2-10 lines) to any component when the user asks for code or implementation details.
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
    Plans the diagram based on prompt and diagram_type.
    Routes to _plan_hld, plan_uml, or architecture LLM.
    """
    prompt = state.get("prompt") or ""
    diagram_type = state.get("diagram_type") or "architecture"
    model = state.get("model") or ""

    from rag import ArchitectureRetriever
    retriever = ArchitectureRetriever()
    context_parts = retriever.search(prompt, top_k=5)
    context_str = "\n- ".join(context_parts) if context_parts else "Use industry best practices."

    llm_to_use = _get_llm_for_request(model) if model else _get_llm_for_request(None)

    # Route to appropriate planner
    if diagram_type == "hld":
        plan = _plan_hld(prompt, llm_to_use, context_str)
        plan, _valid, _retry = _validate_and_retry(
            "hld",
            plan,
            prompt,
            llm_to_use,
            "Keep 'layers' (presentation, application, business, data, external, infrastructure) and 'flows' with from, to, label.",
        )
        return {"diagram_plan": plan}

    if diagram_type == "chat":
        # Chat mode: no planning, just pass prompt to generator
        return {"diagram_plan": {"prompt": prompt, "type": "chat"}}

    if diagram_type not in ("architecture", "hld"):
        from uml_flow import plan_uml
        plan = plan_uml(diagram_type, prompt, llm_to_use)
        return {"diagram_plan": plan}

    if not has_llm:
        # MOCK INTELLIGENCE (Fallback)
        logger.debug("Mock agent: generating simulated plan")
        p = prompt.lower()
        is_repo = "repository analysis" in p or ("repository:" in p and "owner/" in p)
        
        if is_repo and any(w in p for w in ["rails", "ruby", "gemfile", "heroku"]):
            components = [
                {"name": "Rails Web App", "type": "server"},
                {"name": "Database", "type": "database"},
                {"name": "Heroku", "type": "gateway"},
            ]
        elif is_repo:
            components = [{"name": "Application", "type": "server"}]
            if any(w in p for w in ["database", "db", "sql", "postgres", "sqlite"]):
                components.append({"name": "Database", "type": "database"})
            if any(w in p for w in ["heroku", "deploy"]):
                components.append({"name": "Heroku", "type": "gateway"})
            if len(components) == 1:
                components.append({"name": "Database", "type": "database"})
        else:
            components = [{"name": "Load Balancer", "type": "server"}]
            if any(w in p for w in ["auth", "login", "onboarding", "buyer", "supplier"]):
                components.append({"name": "Identity Service", "type": "auth"})
            if "payment" in p:
                components.append({"name": "Payment Gateway", "type": "server"})
                components.append({"name": "Ledger Service", "type": "server"})
            if "invoice" in p or "billing" in p:
                components.append({"name": "Invoice Engine", "type": "function"})
            if any(w in p for w in ["compliance", "risk", "security"]):
                components.append({"name": "Risk Engine", "type": "shield"})
            if any(w in p for w in ["workflow", "approval"]):
                components.append({"name": "Workflow Manager", "type": "queue"})
            if any(w in p for w in ["database", "sql", "reporting", "reconciliation", "settlement"]):
                components.append({"name": "Primary DB", "type": "database"})
                components.append({"name": "Data Whse", "type": "database"})
            if len(components) == 1:
                components.append({"name": "API Service", "type": "server"})
        
        return {"diagram_plan": {"components": components}}

    # REAL INTELLIGENCE (LLM) for Architecture
    is_repo_arch = "repository analysis" in prompt.lower() or ("repository:" in prompt.lower() and "owner/" in prompt.lower())
    repo_arch_hint = ""
    if is_repo_arch:
        repo_arch_hint = (
            "\n\nCRITICAL - Repository analysis: Include ONLY components that appear in the codebase "
            "(Gemfile, package.json, config, README). Do NOT add AWS, Stripe, Redis, etc. unless present."
        )
        if "monorepo" in prompt.lower():
            repo_arch_hint += (
                " MONOREPO: Include ALL projects (apps/*, packages/*). Each app and shared package "
                "must be a component. Do not merge or omit any project."
            )
    system_prompt = f"""You are a Senior Solutions Architect. Analyze the user's request and list the necessary IT components.

BEST PRACTICES / CONTEXT:
- {context_str}
{repo_arch_hint}

Output ONLY a valid JSON object. No markdown, no code fences, no explanation.
Required structure: a single key "components" with an array of objects. Each object must have "name" (string) and "type" (string).
Allowed types: server, database, auth, balancer, client, function, queue, gateway, cdn, cache, search, storage, external, monitoring.

Optional: Add "code" or "snippet" (string) to a component when the user asks for code or implementation (e.g. "show the login function", "architecture with API code", "include code snippets"). Keep snippets short (2-10 lines).

Example: {{"components": [{{"name": "Auth Service", "type": "auth"}}, {{"name": "PostgreSQL", "type": "database"}}, {{"name": "API Gateway", "type": "gateway"}}]}}
Use 3-12 components. Be specific with names and types."""
    
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    raw_plan = None
    try:
        response = (llm_to_use or llm).invoke(messages)
        logger.debug("LLM raw response: %s", response.content[:500] if response.content else "<empty>")
        raw_plan = _extract_json(response.content)
        plan, _valid, _retry = _validate_and_retry(
            "architecture",
            raw_plan,
            prompt,
            (llm_to_use or llm),
            "Keep 'components' as a list of objects with 'name' and 'type'. Types: server, database, auth, balancer, client, function, queue, gateway.",
        )
    except Exception as e:
        logger.exception("LLM error: %s", e)
        plan = get_valid_plan("architecture", raw_plan if isinstance(raw_plan, dict) else {})

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

def _architecture_to_mermaid_tb(components: list[dict], layout_name: str = "Hierarchical", code_detail_level: str = "small") -> dict:
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
            code_block = comp.get("code") or comp.get("snippet")
            code_fmt = _format_code_for_mermaid(code_block, code_detail_level) if code_block else ""
            label = f"{icon} {name}" + (f"<br/>{code_fmt}" if code_fmt else "")

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


def _architecture_to_mermaid_lr(components: list[dict], layout_name: str = "Horizontal", code_detail_level: str = "small") -> dict:
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


def _architecture_to_mermaid_grouped(components: list[dict], layout_name: str = "Grouped", code_detail_level: str = "small") -> dict:
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
    """Sanitize text for use in Mermaid labels. Plain replacements only, no HTML entities."""
    text = text.replace("&", " and ")
    text = text.replace('"', "'")
    text = text.replace("[", "(").replace("]", ")")
    text = text.replace("{", "(").replace("}", ")")
    text = text.replace("<", "").replace(">", "")
    text = text.replace("\\n", " - ").replace("\n", " ")
    return text


def _format_code_for_mermaid(code: str | None, level: str = "small") -> str:
    """
    Format code for Mermaid node labels.
    - small: 2-3 lines or ~150 chars
    - complete: up to ~500 chars
    NO HTML entities - they show as literal text in Mermaid SVG. Use plain replacements.
    """
    if not code or not isinstance(code, str):
        return ""
    text = code.strip()
    if not text:
        return ""
    # Truncate by level
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
    # Plain replacements only - no HTML entities (&#34;, &#40;, &amp; etc show as literal)
    text = text.replace("&", " and ")
    text = text.replace('"', "'")
    text = text.replace("[", "(").replace("]", ")")  # Avoid Mermaid bracket conflicts
    text = text.replace("\n", "<br/>")
    return text


def _mindtree_to_mermaid(plan: dict) -> str:
    """
    Generate Mermaid native mindmap diagram from plan (nodes with id, label, parentId).
    Uses indentation-based hierarchy so Mermaid renders a proper radial/organic mind map,
    not a flowchart. Root is rendered as central node; children branch out by indentation.
    """
    nodes = plan.get("nodes", [])
    if not nodes:
        return "mindmap\n  ((Central Idea))"

    # Build id -> node and parentId -> list of children (order preserved)
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
        """Label safe for mindmap outline: no newlines, brackets escaped for shape ambiguity."""
        t = _sanitize_mermaid_label((s or "").strip()[:60])
        # Avoid )) or (( inside text so root shape parses correctly
        return t.replace("))", ") ").replace("((", "( ").strip() or "Branch"

    def emit_tree(parent_id: str | None, depth: int) -> list[str]:
        out: list[str] = []
        for child in children.get(parent_id, []):
            label = sanitize_mindmap_label(child.get("label") or child.get("id") or "Node")
            indent = "  " * (depth + 1)
            cid = (child.get("id") or "").strip()
            if depth == 0 and parent_id is None:
                # Root: circle for central node
                out.append(f"{indent}(({label}))")
            else:
                # Rounded rectangle for branches (softer than default block)
                out.append(f"{indent}({label})")
            out.extend(emit_tree(cid, depth + 1))
        return out

    # Find root(s): nodes with parentId None, or first node if none
    roots = children.get(None, [])
    if not roots and by_id:
        # No explicit root: pick first node as root
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
    """Same as _mindtree_to_mermaid but with tidy-tree layout (clean hierarchical tree)."""
    body = _mindtree_to_mermaid(plan)
    if body.startswith("mindmap"):
        return "---\nconfig:\n  layout: tidy-tree\n---\n" + body
    return body


def _hld_to_mermaid(plan: dict, code_detail_level: str = "small") -> str:
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
            code_block = comp.get("code") or comp.get("snippet")
            if code_block:
                code_fmt = _format_code_for_mermaid(code_block, code_detail_level)
                if code_fmt:
                    label = f"{label}<br/>{code_fmt}"

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


def _safe_class_id(name: str) -> str:
    """Mermaid-safe class id: alphanumeric and underscore only."""
    s = (str(name) if name else "").strip().replace("-", "_").replace(" ", "_")
    return "".join(c if c.isalnum() or c == "_" else "_" for c in s)[:30] or "C"


def _lld_to_mermaid(plan: dict) -> str:
    """
    Generate Mermaid classDiagram for Low-Level Design.
    Modules with classes, interfaces, and dependencies between modules.
    """
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

        # Interfaces first
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

        # Classes
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

    # Module dependencies: connect first class of each module
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


def _generate_chat_mermaid(prompt: str, llm_to_use) -> str:
    """
    Generate generic Mermaid code for 'Chat' mode.
    Allows user to ask for any diagram type supported by Mermaid.
    """
    if not llm_to_use:
        return "graph TD\n    A[Mock Chat]\n    B[No LLM Configured]\n    A --> B"
        
    system_prompt = """You are a Mermaid.js expert. Generate VALID Mermaid code based on the user's request.
Rules:
1. Return ONLY the Mermaid code. No markdown fences (```mermaid), no explanations.
2. If the user asks for a specific diagram type (Sequence, Class, State, Git, Gantt, Pie, etc.), use that.
3. If the request is vague, infer the best diagram type.
4. Ensure syntax is correct and up-to-date.
5. Do not include 'mermaid' keyword at the start if it's not part of the syntax (e.g. use 'graph TD', 'sequenceDiagram', etc.).
"""
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    try:
        response = llm_to_use.invoke(messages)
        content = response.content.strip()
        # Strip markdown fences if present
        if content.startswith("```mermaid"):
            content = content[10:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()
    except Exception as e:
        logger.exception("Chat generation error: %s", e)
        return "graph TD\n    Error[Generation Failed]\n    Details[Check Logs]"


def update_diagram(current_mermaid: str, prompt: str, model: str | None = None) -> dict:
    """
    Update an existing diagram based on user refinement prompt.
    Takes current Mermaid code and user's update request, returns updated diagram.
    """
    llm_to_use = _get_llm_for_request(model) if model else _get_llm_for_request(None)
    if not llm_to_use:
        return {
            "mermaid": current_mermaid,
            "nodes": [],
            "edges": [],
            "versions": [{"code": current_mermaid, "layout": "Default", "direction": "TB", "description": "No LLM configured"}],
            "selectedVersion": 0,
        }

    system_prompt = """You are a Mermaid.js expert. The user has an existing diagram and wants to update it.
Rules:
1. Return ONLY the updated Mermaid code. No markdown fences (```mermaid), no explanations.
2. Keep the same diagram type (flowchart, sequenceDiagram, classDiagram, etc.) unless the user explicitly asks to change it.
3. Apply the user's requested changes to the existing diagram. Add, remove, or modify elements as requested.
4. Preserve structure and styling that the user did not ask to change.
5. Ensure syntax is valid and up-to-date."""
    user_prompt = f"""Current diagram:
```mermaid
{current_mermaid}
```

User's update request: {prompt}

Return the updated Mermaid diagram code only:"""
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    try:
        response = llm_to_use.invoke(messages)
        content = response.content.strip()
        if content.startswith("```mermaid"):
            content = content[10:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        updated_code = content.strip()
        return {
            "mermaid": updated_code,
            "nodes": [],
            "edges": [],
            "versions": [{"code": updated_code, "layout": "Default", "direction": "TB", "description": "Updated from chat"}],
            "selectedVersion": 0,
        }
    except Exception as e:
        logger.exception("Diagram update error: %s", e)
        return {
            "mermaid": current_mermaid,
            "nodes": [],
            "edges": [],
            "versions": [{"code": current_mermaid, "layout": "Default", "direction": "TB", "description": "Update failed, kept original"}],
            "selectedVersion": 0,
        }


def generator_node(state: AgentState):
    """
    Generates Mermaid diagram code from the plan.
    All diagrams are rendered using Mermaid.js for consistent, auto-layout rendering.
    Returns multiple layout versions for Architecture and HLD diagrams.
    """
    plan = state["diagram_plan"]
    diagram_type = state.get("diagram_type") or "architecture"
    model = state.get("model") or ""
    llm_to_use = _get_llm_for_request(model) if model else _get_llm_for_request(None)
    logger.info(
        "generator_node",
        extra={
            "diagram_type": diagram_type,
            "plan_keys": list(plan.keys()) if isinstance(plan, dict) else [],
        },
    )

    explanation = None
    
    # Chat / Generic Mermaid
    if diagram_type == "chat":
        prompt = plan.get("prompt") or state.get("prompt") or ""
        mermaid_code = _generate_chat_mermaid(prompt, llm_to_use)
        return {"json_output": {
            "mermaid": mermaid_code,
            "nodes": [],
            "edges": [],
            "versions": [{"code": mermaid_code, "layout": "Default", "direction": "TB", "description": "Generated from chat"}],
            "selectedVersion": 0,
        }}
    
    # HLD diagram - generate multiple versions
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

    # LLD diagram - generate multiple versions
    if diagram_type == "lld":
        versions = _generate_lld_versions(plan)
        return {"json_output": {
            "mermaid": versions[0]["code"] if versions else "",
            "nodes": [],
            "edges": [],
            "versions": versions,
            "selectedVersion": 0,
        }}

    # Mind tree diagram - native Mermaid mindmap (radial/organic) + optional Tidy Tree layout
    if diagram_type == "mindtree":
        mermaid_code = _mindtree_to_mermaid(plan)
        tidy_code = _mindtree_to_mermaid_tidy(plan)
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

    # Architecture diagram - generate multiple layout versions
    if diagram_type == "architecture":
        components = plan.get("components", [])
        if not components:
            return {"json_output": {"mermaid": "", "nodes": [], "edges": [], "versions": []}}

        code_level = (state.get("code_detail_level") or "small").lower()
        if code_level not in ("small", "complete"):
            code_level = "small"

        # Generate 3 layout versions
        versions = [
            _architecture_to_mermaid_tb(components, "Hierarchical", code_level),
            _architecture_to_mermaid_lr(components, "Horizontal Flow", code_level),
            _architecture_to_mermaid_grouped(components, "Grouped", code_level),
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
    code_level = (state.get("code_detail_level") or "small").lower()
    if code_level not in ("small", "complete"):
        code_level = "small"
    mermaid_code = plan_to_mermaid(diagram_type, plan, code_level)
    
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


def _generate_hld_versions(plan: dict, code_detail_level: str = "small") -> list[dict]:
    """Generate multiple HLD layout versions."""
    layers = plan.get("layers", {})
    flows = plan.get("flows", [])
    
    versions = []
    
    # Version 1: Standard TB layout
    versions.append({
        "code": _hld_to_mermaid(plan, code_detail_level),
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


def _generate_lld_versions(plan: dict) -> list[dict]:
    """Generate multiple LLD layout versions (classDiagram with different directions)."""
    base_code = _lld_to_mermaid(plan)
    lines = base_code.split("\n")
    rest = "\n".join(lines[1:]) if len(lines) > 1 else ""
    versions = [
        {
            "code": "classDiagram\n    direction TB\n" + rest,
            "layout": "Hierarchical",
            "direction": "TB",
            "description": "Top-to-bottom class view",
        },
        {
            "code": "classDiagram\n    direction LR\n" + rest,
            "layout": "Horizontal",
            "direction": "LR",
            "description": "Left-to-right class view",
        },
    ]
    return versions


# --- Graph Construction ---
workflow = StateGraph(AgentState)

workflow.add_node("planner", planner_node)
workflow.add_node("generator", generator_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "generator")
workflow.add_edge("generator", END)

app = workflow.compile()

def run_agent(prompt: str, diagram_type: str = "architecture", model: str | None = None, code_detail_level: str | None = None):
    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    inputs = {"prompt": prompt, "messages": [], "diagram_type": diagram_type, "model": model or "", "code_detail_level": level}
    result = app.invoke(inputs)
    output = result["json_output"]
    if result.get("diagram_plan"):
        output["diagram_plan"] = result["diagram_plan"]
    return output


def format_plan_for_display(plan: dict, diagram_type: str) -> str:
    """
    Format a diagram plan as a readable, detailed string for display in the chat panel.
    """
    lines: list[str] = []
    dt = (diagram_type or "architecture").lower()

    if dt in ("architecture", "flowchart"): # Reverted to include "flowchart"
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


def generate_repo_explanation(raw_summary: str, model: str | None = None) -> str:
    """
    Generate a user-friendly, detailed explanation of a GitHub repository from its raw analysis.
    Used when creating diagrams from repos: show in chat so users understand the repo first.
    """
    llm_to_use = _get_llm_for_request(model) if model else _get_llm_for_request(None)
    if not has_llm or not llm_to_use:
        # Fallback: return first 1500 chars of raw summary as readable intro
        intro = raw_summary[:1500].strip()
        if len(raw_summary) > 1500:
            intro += "\n\n... (further analysis used for diagram generation)"
        return intro

    system = """You are a technical analyst. Given raw repository analysis (structure, config files, README, source snippets), write a clear, concise explanation for a developer.

Your explanation should:
1. Describe what the repository does (purpose, main features, tech stack)
2. Summarize the architecture and key components (backend, frontend, APIs, etc.)
3. Note important integrations, deployment setup, or patterns
4. Be 150-400 words, well-structured with short paragraphs
5. Use plain language—no raw JSON or code dumps
6. Focus on what a developer would want to know before looking at the code"""
    prompt = f"""Analyze this repository and write a detailed explanation:\n\n{raw_summary[:18000]}"""
    messages = [SystemMessage(content=system), HumanMessage(content=prompt)]
    try:
        response = (llm_to_use or llm).invoke(messages)
        text = (response.content or "").strip()
        return text[:4000] if text else raw_summary[:1500]
    except Exception as e:
        logger.warning("repo_explanation_llm_failed: %s", e)
        return raw_summary[:1500] + "\n\n(LLM explanation unavailable; diagram based on raw analysis.)"



def run_plan_only(prompt: str, diagram_type: str = "architecture", model: str | None = None) -> dict:
    """Run only the planner; returns diagram_plan for preview/confirmation. No new deps."""
    state = {"prompt": prompt, "messages": [], "diagram_type": diagram_type, "model": model or ""}
    out = planner_node(state)
    return out["diagram_plan"]


def run_generator_from_plan(diagram_plan: dict, diagram_type: str, code_detail_level: str = "small") -> dict:
    """Generate diagram output from an existing plan (e.g. after user confirmation). No LLM call."""
    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    state = {
        "diagram_plan": diagram_plan,
        "diagram_type": diagram_type,
        "messages": [],
        "prompt": "",
        "model": "",
        "code_detail_level": level,
    }
    out = generator_node(state)
    result = out["json_output"]
    result["diagram_plan"] = diagram_plan
    return result
