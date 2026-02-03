import logging
import os
from pinecone import Pinecone
from typing import List

logger = logging.getLogger("architectai.rag")


class ArchitectureRetriever:
    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX", "architect-ai-memory")
        openai_key = os.getenv("OPENAI_API_KEY")
        # Only use Pinecone when BOTH keys are set (embeddings need OpenAI, which is paid).
        # Otherwise use built-in context — 100% free.
        self.mock_mode = not (self.api_key and openai_key)

        if not self.mock_mode:
            try:
                self.pc = Pinecone(api_key=self.api_key)
                self.index = self.pc.Index(self.index_name)
            except Exception as e:
                logger.warning("Pinecone error: %s. Switching to mock mode.", e)
                self.mock_mode = True
        else:
            logger.debug("RAG: using built-in context (free). Set PINECONE_API_KEY + OPENAI_API_KEY for vector RAG.")

    def search(self, query: str, top_k: int = 3) -> List[str]:
        """
        Retrieves relevant architectural templates or rules based on the user prompt.
        """
        if self.mock_mode:
            return self._get_mock_context(query)
        
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            # Generate Embedding
            response = client.embeddings.create(input=query, model="text-embedding-3-small")
            query_embedding = response.data[0].embedding
            
            # Query Pinecone
            results = self.index.query(vector=query_embedding, top_k=top_k, include_metadata=True)
            
            # Extract Text
            matches = [match['metadata']['text'] for match in results['matches']]
            
            # Fallback if empty (cold start)
            if not matches:
                return self._get_mock_context(query)
                
            return matches
            
        except Exception as e:
            logger.warning("Retrieval error: %s. Falling back to mock.", e)
            return self._get_mock_context(query)

    def _get_mock_context(self, query: str) -> List[str]:
        """
        Returns architecture best-practice context (production-quality RAG fallback).
        Used when Pinecone is not configured or retrieval fails.
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

        return context
