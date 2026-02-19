"""Diagram planning: HLD, architecture, and UML routing to plan_uml."""
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from diagram_validator import get_valid_plan
from agent.state import AgentState
from agent.parser import extract_json, validate_and_retry
from agent.llm_setup import get_llm_for_request, has_llm, llm

logger = logging.getLogger("architectai.agent.planner")


def _plan_hld(prompt: str, llm_to_use, context_str: str) -> dict:
    """Plan a detailed High-Level Design diagram."""
    if not has_llm:
        logger.debug("Mock HLD: generating simulated plan")
        p = prompt.lower()
        is_repo_analysis = "repository analysis" in p or ("repository:" in p and "owner/" in p)
        layers = {
            "presentation": [], "application": [], "business": [],
            "data": [], "external": [], "infrastructure": []
        }
        if is_repo_analysis and any(w in p for w in ["rails", "ruby", "gemfile"]):
            layers["presentation"].append({"name": "Web UI", "type": "webapp", "tech": "Rails/ERB"})
        elif any(w in p for w in ["web", "ui", "frontend", "portal", "dashboard"]):
            layers["presentation"].append({"name": "Web Portal", "type": "webapp", "tech": "React/Next.js"})
        if any(w in p for w in ["mobile", "app", "ios", "android"]) and not is_repo_analysis:
            layers["presentation"].append({"name": "Mobile App", "type": "mobile", "tech": "React Native"})
        if not layers["presentation"]:
            layers["presentation"].append({"name": "Web Application", "type": "webapp", "tech": "React"})
        if not is_repo_analysis:
            layers["application"].append({"name": "API Gateway", "type": "gateway", "tech": "Kong/nginx"})
        if any(w in p for w in ["auth", "login", "sso", "oauth"]):
            layers["application"].append({"name": "Auth Service", "type": "auth", "tech": "OAuth2/JWT"})
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
        if not is_repo_analysis:
            if any(w in p for w in ["payment", "stripe", "paypal"]):
                layers["external"].append({"name": "Payment Gateway", "type": "external", "tech": "Stripe"})
            if any(w in p for w in ["email", "sendgrid", "mailgun"]):
                layers["external"].append({"name": "Email Provider", "type": "external", "tech": "SendGrid"})
            if any(w in p for w in ["storage", "s3", "file", "upload"]):
                layers["external"].append({"name": "Object Storage", "type": "external", "tech": "AWS S3"})
        if not is_repo_analysis:
            layers["infrastructure"].append({"name": "Load Balancer", "type": "lb", "tech": "ALB"})
            layers["infrastructure"].append({"name": "CDN", "type": "cdn", "tech": "CloudFront"})
        elif any(w in p for w in ["heroku", "deploy"]):
            layers["infrastructure"].append({"name": "Heroku", "type": "lb", "tech": "Heroku"})
        flows = [
            {"from": "presentation", "to": "application", "label": "HTTPS/REST"},
            {"from": "application", "to": "business", "label": "gRPC/REST"},
            {"from": "business", "to": "data", "label": "TCP/SQL"},
            {"from": "business", "to": "external", "label": "HTTPS"},
        ]
        return {"layers": layers, "flows": flows, "type": "hld"}

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
            "presentation": [ {{"name": "Component Name", "type": "webapp|mobile|desktop", "tech": "Technology Stack"}} ],
            "application": [ {{"name": "Component Name", "type": "gateway|auth|api", "tech": "Technology"}} ],
            "business": [ {{"name": "Service Name", "type": "service", "tech": "Language/Framework"}} ],
            "data": [ {{"name": "Storage Name", "type": "database|cache|queue|search", "tech": "Technology"}} ],
            "external": [ {{"name": "External Service", "type": "external", "tech": "Provider"}} ],
            "infrastructure": [ {{"name": "Infra Component", "type": "lb|cdn|dns|monitoring", "tech": "Technology"}} ]
        }},
        "flows": [ {{"from": "layer_name", "to": "layer_name", "label": "Protocol/Method"}} ]
    }}

Include relevant components based on the system requirements. Be specific with technology choices.
Optional: Add "code" or "snippet" (string, 2-10 lines) to any component when the user asks for code or implementation details.
"""
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    try:
        response = (llm_to_use or llm).invoke(messages)
        logger.debug("HLD LLM raw response: %s", response.content[:500] if response.content else "<empty>")
        plan = extract_json(response.content)
        plan["type"] = "hld"
    except Exception as e:
        logger.exception("HLD LLM error: %s", e)
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


def planner_node(state: AgentState) -> dict:
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

    llm_to_use = get_llm_for_request(model) if model else get_llm_for_request(None)

    if diagram_type == "hld":
        plan = _plan_hld(prompt, llm_to_use, context_str)
        plan, _valid, _retry = validate_and_retry(
            "hld",
            plan,
            prompt,
            llm_to_use,
            "Keep 'layers' (presentation, application, business, data, external, infrastructure) and 'flows' with from, to, label.",
        )
        return {"diagram_plan": plan}

    if diagram_type == "chat":
        return {"diagram_plan": {"prompt": prompt, "type": "chat"}}

    if diagram_type not in ("architecture", "hld"):
        from uml_flow import plan_uml
        plan = plan_uml(diagram_type, prompt, llm_to_use)
        return {"diagram_plan": plan}

    if not has_llm:
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
        raw_plan = extract_json(response.content)
        plan, _valid, _retry = validate_and_retry(
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
