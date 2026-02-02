import logging
import os
from pinecone import Pinecone
from typing import List

logger = logging.getLogger("architectai.rag")


class ArchitectureRetriever:
    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX", "architect-ai-memory")
        self.mock_mode = not self.api_key
        
        if not self.mock_mode:
            try:
                self.pc = Pinecone(api_key=self.api_key)
                self.index = self.pc.Index(self.index_name)
            except Exception as e:
                logger.warning("Pinecone error: %s. Switching to mock mode.", e)
                self.mock_mode = True
        else:
            logger.info("Pinecone API key missing. Running in mock mode.")

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
        Returns hardcoded "Best Practices" to simulate RAG for the MVP.
        """
        q = query.lower()
        context = []
        
        # General Best Practices
        context.append("General Rule: Always place a Load Balancer before Application Servers for high availability.")
        
        if "auth" in q or "login" in q:
             context.append("Security Rule: Use a dedicated Identity Provider (like Clerk/Auth0) instead of rolling your own auth.")
             context.append("Pattern: Public Client -> Load Balancer -> Auth Service -> Private API.")
        
        if "database" in q or "sql" in q:
             context.append("Database Rule: Production databases should be in a private subnet, accessed only by the API Server.")
             context.append("Scalability: Use Read Replicas for high read-heavy workloads.")

        if "aws" in q:
             context.append("AWS Pattern: Use CloudFront -> S3 for frontend hosting.")
             context.append("AWS Pattern: Use ALB (Application Load Balancer) for HTTP traffic.")

        return context
