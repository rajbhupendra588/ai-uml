# RAG (Retrieval-Augmented Generation)

RAG improves diagram quality by injecting architecture best-practice context into the LLM for **architecture** and **HLD** diagrams.

## Modes

- **Mock (default):** When `PINECONE_API_KEY` is not set, the backend uses built-in best-practice snippets (see `backend/rag.py` → `_get_mock_context`). No extra setup; keeps the app light.
- **Pinecone (optional):** When `PINECONE_API_KEY` and `OPENAI_API_KEY` are set, the backend embeds the user prompt, queries Pinecone, and uses returned snippets as context. Requires an index and seeded content.

## Index schema (Pinecone)

- **Index name:** `PINECONE_INDEX` env var, default `architect-ai-memory`.
- **Vectors:** From OpenAI `text-embedding-3-small` (dimension depends on model; typically 1536).
- **Metadata:** Each vector should have a `text` field (string) containing the snippet to inject (e.g. a rule, pattern, or doc paragraph).

Example upsert shape:

```json
{
  "id": "rule-1",
  "values": [0.1, -0.2, ...],
  "metadata": { "text": "Use a Load Balancer before Application Servers for high availability." }
}
```

## Seeding

1. Create an index in Pinecone with the same dimension as your embedding model.
2. Embed your architecture docs/rules (e.g. with OpenAI embeddings).
3. Upsert with `metadata.text` set to the snippet text.
4. Set `PINECONE_API_KEY` and `PINECONE_INDEX` (and `OPENAI_API_KEY` for embeddings) in the backend environment.

If the index is empty or a query returns no matches, the backend falls back to mock context. RAG remains optional; the app works without it.
