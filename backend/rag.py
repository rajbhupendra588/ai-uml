"""
RAG (Retrieval-Augmented Generation) for architecture best practices.
Uses built-in context patterns - no external dependencies required.
"""
import logging
from typing import List

logger = logging.getLogger("architectai.rag")


class ArchitectureRetriever:
    """
    Provides architecture best-practice context for diagram generation.
    Uses curated patterns and rules - 100% free, no API keys required.
    """
    
    def __init__(self):
        logger.debug("RAG: using built-in architecture best practices (no external dependencies)")

    def search(self, query: str, top_k: int = 3) -> List[str]:
        """
        Returns relevant architectural patterns and rules based on the user prompt.
        """
        return self._get_context(query)

    def _get_context(self, query: str) -> List[str]:
        """
        Returns architecture best-practice context based on query keywords.
        Production-quality patterns curated from industry standards.
        """
        q = query.lower()
        context: List[str] = []

        # Always include core rules
        context.append("General Rule: Always place a Load Balancer before Application Servers for high availability.")
        context.append("Output Quality: Be specific with component names and technology choices; avoid generic placeholders.")

        if "auth" in q or "login" in q or "sso" in q or "identity" in q:
            context.append("Security Rule: Use a dedicated Identity Provider (Clerk/Auth0/Keycloak) instead of rolling your own auth.")
            context.append("Pattern: Public Client -> Load Balancer -> Auth Service -> Private API.")

        if "database" in q or "sql" in q or "postgres" in q or "mysql" in q or "mongodb" in q:
            context.append("Database Rule: Production databases in a private subnet, accessed only by the API layer.")
            context.append("Scalability: Use Read Replicas for read-heavy workloads; consider connection pooling.")

        if "aws" in q or "amazon" in q or "cloud" in q:
            context.append("AWS Pattern: CloudFront -> S3 for static frontend; ALB for HTTP/API traffic.")
            context.append("AWS Pattern: Prefer managed services (RDS, ElastiCache, SQS) over self-hosted where possible.")

        if "microservice" in q or "microservices" in q or "service" in q:
            context.append("Microservices: Each service should have a single responsibility; use API Gateway for routing.")
            context.append("Inter-service: Prefer async messaging (SQS/Kafka) for decoupling; sync REST when latency matters.")

        if "api" in q or "rest" in q or "graphql" in q:
            context.append("API Layer: Place API Gateway at the edge; rate limiting and auth at gateway.")
            context.append("Versioning: Support API versioning (path or header) for backward compatibility.")

        if "queue" in q or "kafka" in q or "rabbitmq" in q or "event" in q or "async" in q:
            context.append("Event/Queue: Message queue between services for async workflows and event-driven flows.")
            context.append("Resilience: Use dead-letter queues and retries for failed messages.")

        if "cache" in q or "redis" in q:
            context.append("Caching: Cache layer (e.g. Redis) between app and database for hot data; set TTLs.")
            context.append("Cache invalidation: Prefer event-based invalidation over time-based where possible.")

        if "kubernetes" in q or "k8s" in q or "container" in q or "docker" in q:
            context.append("Containers: Orchestrate with Kubernetes; use Ingress for external traffic, Service for internal.")
            context.append("Deployment: Separate deployment from database; use health checks and readiness probes.")

        if "monitoring" in q or "observability" in q or "logging" in q:
            context.append("Observability: Centralized logging and metrics (e.g. Prometheus + Grafana); trace IDs across services.")

        if "payment" in q or "billing" in q or "stripe" in q:
            context.append("Payments: Use a payment gateway (Stripe/PayPal); never store credit card data yourself (PCI compliance).")
            context.append("Pattern: Client -> API -> Payment Gateway; use webhooks for async payment confirmations.")

        if "cdn" in q or "static" in q or "frontend" in q:
            context.append("Static Assets: Serve via CDN (CloudFront/Cloudflare) for global low-latency access.")
            context.append("Frontend: Separate static frontend (S3+CDN) from dynamic API (load balanced servers).")

        if "security" in q or "encryption" in q or "ssl" in q:
            context.append("Security: Always use HTTPS/TLS; encrypt data at rest and in transit.")
            context.append("Secrets: Use secret management (AWS Secrets Manager, HashiCorp Vault); never commit secrets to git.")

        return context
