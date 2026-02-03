# Future Enhancements — Delivery Plan

This document outlines a prioritized plan for future enhancements to **AI-UML (ArchitectAI)**. It is based on the current codebase: FastAPI backend, Next.js frontend, ReactFlow canvas, OpenRouter/OpenAI integration, GitHub OAuth, repo-based generation, and RAG (Pinecone mock/real).

---

## Priority 1 — Security & Production Readiness

| # | Enhancement | Description | Effort |
|---|-------------|-------------|--------|
| 1.1 | **Remove secrets from `.env.example`** | `.env.example` must never contain real API keys, tokens, or `SECRET_KEY`. Replace with placeholders only (e.g. `OPENROUTER_API_KEY=your_key_here`). Rotate any exposed keys immediately. | S |
| 1.2 | **API rate limiting** | Add rate limiting (e.g. per IP or per user) on `/api/v1/generate` and `/api/v1/generate-from-repo` to prevent abuse and control LLM costs. Use slowapi or similar. | M |
| 1.3 | **Persistent session store** | Replace in-memory session store in `auth.py` with Redis (or DB-backed store) so sessions survive restarts and work across multiple instances (e.g. on Render). | M |
| 1.4 | **Request size & validation** | Enforce `MAX_PROMPT_LENGTH` and add optional max payload size for repo analysis. Return clear 400 errors for invalid input. | S |

---

## Priority 2 — AI & Diagram Quality

| # | Enhancement | Description | Effort | Status |
|---|-------------|-------------|--------|--------|
| 2.1 | **Streaming diagram generation** | Stream LLM output (e.g. SSE) so users see progress for long-running generations and can cancel mid-way. | M | Pending |
| 2.2 | **RAG production rollout** | Make Pinecone RAG the default when `PINECONE_API_KEY` is set; add embedding via OpenRouter/OpenAI; document index schema and seeding. | M | Doc: `docs/RAG.md`. Optional. |
| 2.3 | **“Refine diagram” with AI** | New flow: user selects part of diagram or describes a change in natural language → API returns updated nodes/edges (or diff). | L | Pending |
| 2.4 | **Multi-step generation with confirmation** | For complex prompts, optionally show a short “plan” (e.g. list of components) and let user confirm before full diagram generation. | M | **Backend done:** `/api/v1/plan`, `/api/v1/generate-from-plan`. |
| 2.5 | **Diagram validation & repair** | Validate generated JSON (required fields, allowed types); optional auto-repair or retry with a corrected prompt. | M | **Done:** validator + retry in agent/uml_flow. |

---

## Priority 3 — Canvas & User Experience

| # | Enhancement | Description | Effort | Status |
|---|-------------|-------------|--------|--------|
| 3.1 | **Undo / Redo** | Full undo/redo stack for node and edge changes (add, delete, move, edit). Persist stack in memory; optionally cap depth. | M | **Done:** history (cap 50), Ctrl+Z / Ctrl+Shift+Z. |
| 3.2 | **Save & load projects** | Allow saving current diagram (+ metadata) to backend or file (JSON). Load saved project to restore canvas state. Requires backend storage (DB or object store) if cloud save. | L | Pending |
| 3.3 | **Keyboard shortcuts** | Shortcuts for: new diagram, generate, export PNG/SVG/PDF, undo/redo, zoom fit, toggle panels. Document in UI (e.g. “?” overlay). | S | **Done:** Ctrl+0/N/E/1/2, ?, help overlay. |
| 3.4 | **Accessibility (a11y)** | ARIA labels, focus management, keyboard navigation for canvas and panels. Ensure theme toggle and export are screen-reader friendly. | M | **Done:** ARIA labels, 44px targets, focus-visible. |
| 3.5 | **Responsive / mobile** | Improve layout and touch support for smaller screens; consider read-only or simplified canvas on mobile. | M | **Done:** Sidebars max-w, 44px touch targets. |
| 3.6 | **Version history in UI** | Expand VersionSwitcher: persist versions in backend per user/session; show diff or thumbnails between versions. | M | Pending |

---

## Priority 4 — GitHub & Repositories

| # | Enhancement | Description | Effort |
|---|-------------|-------------|--------|
| 4.1 | **Private repo access** | Use GitHub OAuth token (when user is logged in) for “generate from repo” so private repos can be analyzed. Fall back to public-only when not logged in. | M |
| 4.2 | **Branch & path selection** | Allow user to pick branch/tag and optionally a subfolder (e.g. `backend/`) before running repo analysis. | M |
| 4.3 | **Cache repo analysis** | Cache `analyze_repo` results by `(owner, repo, ref)` with TTL to reduce GitHub API calls and speed up repeated generations. | S |
| 4.4 | **GitLab / Bitbucket** | Optional adapters for GitLab and Bitbucket repo URLs with similar “analyze repo → summary → generate” flow. | L |

---

## Priority 5 — Platform & Product

| # | Enhancement | Description | Effort |
|---|-------------|-------------|--------|
| 5.1 | **User accounts & project storage** | Optional sign-up (e.g. email or keep GitHub-only); store projects (diagrams + metadata) per user; list/load/delete projects. | L |
| 5.2 | **Usage & billing (if commercial)** | Track usage (e.g. generations per user); optional limits and upgrade path. Integrate Stripe or similar if monetizing. | L |
| 5.3 | **Public API for integrations** | Documented REST API (with API key or OAuth) for third-party tools (CLI, IDE plugins, CI) to generate diagrams programmatically. | M |
| 5.4 | **Webhooks / CI** | Webhook or CLI that can be called from CI (e.g. on push) to regenerate diagrams and optionally commit to repo (e.g. `docs/diagram.png`). | L |
| 5.5 | **Analytics (privacy-conscious)** | Anonymous usage metrics (diagram types, success/failure, latency) for product improvement; respect Do Not Track and GDPR. | S |

---

## Priority 6 — DevOps & Quality

| # | Enhancement | Description | Effort |
|---|-------------|-------------|--------|
| 6.1 | **End-to-end tests** | E2E tests (e.g. Playwright) for critical paths: open app → select type → generate → export. Run in CI. | M |
| 6.2 | **Load & resilience testing** | Load test `/api/v1/generate` and `/generate-from-repo`; define SLOs and add timeouts/retries for LLM and GitHub. | S |
| 6.3 | **Structured logging & APM** | Structured logs (JSON) with request id, user id (if any), diagram type, duration. Optional APM (e.g. OpenTelemetry) for traces. | S |
| 6.4 | **Feature flags** | Simple feature flags (env or config) to toggle new features (e.g. streaming, new diagram types) without redeploys. | S |

---

## Suggested Delivery Order

1. **Immediate:** 1.1 (secrets), 1.4 (validation).  
2. **Short term:** 1.2 (rate limiting), 3.3 (keyboard shortcuts), 6.3 (logging).  
3. **Next:** 1.3 (sessions), 2.1 (streaming), 4.1 (private repos), 4.3 (cache).  
4. **Medium term:** 2.2 (RAG), 3.1 (undo/redo), 3.2 (save/load), 5.3 (public API).  
5. **Longer term:** 2.3 (refine), 3.2 (cloud save), 5.1 (accounts), 5.4 (CI webhooks).

Effort key: **S** = small (days), **M** = medium (1–2 weeks), **L** = large (3+ weeks).

---

## How to Use This Document

- **Product / roadmap:** Pick items by priority and effort for upcoming sprints.
- **Contributors:** Use as a source of ideas for issues and PRs.
- **Stakeholders:** Reference when discussing scope and timelines.
- **Principle:** Prefer lightweight options for new features (see `docs/PRINCIPLES.md` — keep the app light).

Update this plan as items are delivered or as new ideas emerge.
