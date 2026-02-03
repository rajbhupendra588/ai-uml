# Project Principles

## Keep the app light

This project should stay **lightweight** in dependencies, bundle size, and runtime footprint. Every change should respect this.

### What “light” means

- **Frontend**: Minimal npm dependencies; avoid heavy UI libraries or duplicate solutions. Prefer small, focused packages. Lazy-load or code-split where it clearly reduces initial load.
- **Backend**: No unnecessary Python packages. Prefer stdlib or a single well-maintained lib per concern (e.g. one HTTP client, one LLM integration). Optional features (e.g. RAG, Pinecone) should remain optional and not pull in extra deps for core flows.
- **Runtime**: No long-lived background jobs or heavy in-memory caches unless justified. Keep cold starts and memory use reasonable for the target hosting (e.g. Render, Vercel).

### When adding something new

1. **Do we need a new dependency?** Prefer existing deps or stdlib. If adding one, justify and prefer small, maintained packages.
2. **Can it be optional?** If a feature is not core (e.g. advanced export, RAG), make it opt-in via env or feature flag so the default path stays light.
3. **Bundle impact (frontend):** Prefer dynamic imports for large or rarely used features (e.g. PDF export, heavy charts).

### Red lines

- Don’t add a dependency “for convenience” when a few lines of code or an existing dep can do it.
- Don’t add always-on background processes or heavy default caches without a clear need.
- Don’t grow the critical path (first load, first diagram) with optional or future features.

This principle is reflected in `.cursor/rules/` so AI-assisted changes keep the app light by default.
