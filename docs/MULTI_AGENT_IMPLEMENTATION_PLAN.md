# Multi-Agent Mode — Implementation Plan

> **ArchitectAI: Distributed Execution with Master-Worker Pattern**
> 
> Date: 2026-02-20 | Status: Draft | Author: Bhupendra + AI

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1 — Core Multi-Agent Infrastructure](#3-phase-1--core-multi-agent-infrastructure-backend)
4. [Phase 2 — Integration with Existing Flows](#4-phase-2--integration-with-existing-flows)
5. [Phase 3 — Frontend: Real-Time Progress UI](#5-phase-3--frontend-real-time-progress-ui)
6. [File Change Map](#6-file-change-map)
7. [API Contract Changes](#7-api-contract-changes)
8. [Error Handling & Resilience](#8-error-handling--resilience)
9. [Configuration & Environment](#9-configuration--environment)
10. [Testing Strategy](#10-testing-strategy)
11. [Migration & Rollout Plan](#11-migration--rollout-plan)

---

## 1. Executive Summary

### Goal
Add a **multi-agent execution mode** to ArchitectAI that uses a **master-worker pattern** for complex diagram generation tasks. The master agent thinks, plans, and decomposes tasks; worker agents execute sub-tasks in **parallel** and in **isolation**; an aggregator merges results into a final diagram.

### Key Principles
- **Master thinks & plans** → decomposes the user prompt into sub-tasks
- **Workers execute in parallel isolation** → each worker has its own context, no shared mutable state
- **Related tasks grouped** → the master assigns related sub-tasks to the same worker
- **Backward compatible** → simple prompts still use the fast single-agent pipeline
- **LangGraph native** → uses `Send()` API for dynamic fan-out (already in our dependencies)

### When Multi-Agent Activates
| Scenario | Mode | Reason |
|----------|------|--------|
| Simple prompt ("draw login flow") | **Single-agent** | Low complexity, no benefit from parallelism |
| Complex prompt ("design microservices for e-commerce with 8+ services") | **Multi-agent** | High complexity, parallelizable sub-tasks |
| Repo analysis (`/generate-from-repo`) | **Multi-agent** | Multiple parallel analysis phases |
| Diagram update (`/update`) | **Single-agent** | Incremental edit, not decomposable |

---

## 2. Architecture Overview

### Current Pipeline (Single-Agent)
```
User Prompt → Planner Node → Generator Node → Mermaid Output
                 (LLM)         (template)
```

**Files involved:** `agent/__init__.py`, `agent/planner.py`, `agent/generator.py`, `agent/state.py`

### New Pipeline (Multi-Agent)
```
                          ┌─────────────────┐
                          │  Complexity      │
                          │  Classifier      │
                          └────────┬────────┘
                                   │
                        ┌──────────┴──────────┐
                        │                     │
                   (simple)              (complex)
                        │                     │
                 ┌──────▼──────┐      ┌───────▼───────┐
                 │  Legacy     │      │   Master      │
                 │  Pipeline   │      │  (Decomposer) │
                 │  (planner → │      └───────┬───────┘
                 │   generator)│              │
                 └─────────────┘    ┌─────────┼─────────┐
                                    ▼         ▼         ▼
                             ┌──────────┐ ┌──────────┐ ┌──────────┐
                             │ Worker 1 │ │ Worker 2 │ │ Worker N │
                             │ (tasks   │ │ (tasks   │ │ (tasks   │
                             │  A, B)   │ │  C)      │ │  D, E)   │
                             └────┬─────┘ └────┬─────┘ └────┬─────┘
                                  │            │            │
                                  └────────────┼────────────┘
                                               │
                                       ┌───────▼───────┐
                                       │  Aggregator   │
                                       │  (Merge +     │
                                       │   Validate)   │
                                       └───────┬───────┘
                                               │
                                       ┌───────▼───────┐
                                       │  Generator    │
                                       │  (Mermaid)    │
                                       └───────────────┘
```

---

## 3. Phase 1 — Core Multi-Agent Infrastructure (Backend)

### 3.1 New File: `backend/agent/state.py` (MODIFY)

**Current state (14 lines):**
```python
class AgentState(TypedDict):
    messages: List[str]
    prompt: str
    diagram_type: str
    model: str
    diagram_plan: dict
    json_output: dict
    code_detail_level: str
    model_thinking: str
```

**Changes — add multi-agent fields:**
```python
class AgentState(TypedDict):
    # --- Existing fields (keep all) ---
    messages: List[str]
    prompt: str
    diagram_type: str
    model: str
    diagram_plan: dict
    json_output: dict
    code_detail_level: str
    model_thinking: str
    
    # --- New: Multi-agent fields ---
    execution_mode: str                      # "single" | "multi"
    task_plan: list[dict]                    # Master's decomposed sub-tasks
    worker_results: dict[str, dict]          # worker_id -> {sub_plans, thinking, errors}
    agent_progress: list[dict]               # Real-time progress events for frontend


class WorkerState(TypedDict):
    """Isolated state for each worker agent. No shared mutable state."""
    worker_id: str
    assigned_tasks: list[dict]               # Sub-tasks from master
    prompt: str                              # Original user prompt (read-only context)
    diagram_type: str
    model: str
    code_detail_level: str
    
    # Worker outputs
    sub_plan: dict                           # Worker's partial plan
    worker_thinking: str                     # Worker's reasoning
    error: str | None                        # Error if worker failed
```

**Why:** The `WorkerState` is intentionally separate from `AgentState` to enforce isolation. Workers cannot see or mutate other workers' results.

---

### 3.2 New File: `backend/agent/classifier.py` (CREATE)

**Purpose:** Determine whether a prompt is complex enough to warrant multi-agent execution.

```python
"""Complexity classifier: decides single-agent vs multi-agent execution."""

def classify_complexity(prompt: str, diagram_type: str) -> dict:
    """
    Analyze prompt complexity and return execution recommendation.
    
    Returns:
        {
            "mode": "single" | "multi",
            "complexity_score": int (1-10),
            "reason": str,
            "estimated_workers": int
        }
    """
```

**Classification heuristics (no LLM call needed):**
| Signal | Weight | Example |
|--------|--------|---------|
| Prompt length > 500 chars | +2 | Long detailed requirements |
| Multiple system keywords (>5 unique) | +2 | "auth, payment, cart, notification, search" |
| "microservice" / "distributed" keywords | +3 | Explicitly asks for complex system |
| Repo analysis mode | +3 | Always benefits from parallel analysis |
| diagram_type in ("architecture", "hld") | +1 | These types are decomposable |
| diagram_type in ("class", "sequence", "flowchart") | -2 | Usually not decomposable |
| Monorepo detected | +2 | Multiple apps to analyze |

**Threshold:** Score ≥ 5 → multi-agent mode

**File size:** ~80 lines

---

### 3.3 New File: `backend/agent/master.py` (CREATE)

**Purpose:** The "brain" — analyzes the prompt, decomposes into sub-tasks, and groups related tasks for workers.

```python
"""Master agent: thinks, plans, and decomposes tasks for worker agents."""

def master_node(state: AgentState) -> dict:
    """
    1. Analyze the prompt and diagram_type
    2. Decompose into sub-tasks
    3. Group related tasks for the same worker
    4. Return task_plan with worker assignments
    
    Returns updated state with:
        - task_plan: list of sub-tasks with worker assignments
        - model_thinking: master's reasoning about decomposition
        - agent_progress: [{"phase": "master", "status": "complete", ...}]
    """
```

**Sub-task schema:**
```python
{
    "task_id": "t1",
    "worker_id": "w1",           # Which worker handles this
    "task_type": "component_analysis",  # What kind of work
    "description": "Analyze auth and user management components",
    "context": "...",            # Relevant subset of prompt
    "dependencies": [],          # Task IDs this depends on (for future DAG support)
    "priority": 1                # Lower = higher priority
}
```

**Task types the master can assign:**
| Task Type | What It Does | Example |
|-----------|-------------|---------|
| `component_analysis` | Identify components for a domain area | "Analyze payment components" |
| `relationship_mapping` | Map connections between components | "Map data flow between services" |
| `layer_design` | Design a specific HLD layer | "Design the data layer" |
| `repo_file_analysis` | Analyze specific repo files | "Analyze package.json and api routes" |
| `repo_structure_analysis` | Analyze repo directory structure | "Analyze monorepo workspace structure" |
| `tech_stack_detection` | Detect technologies used | "Identify frameworks and databases" |

**Grouping logic (related tasks → same worker):**
- Tasks sharing the same domain (auth + user mgmt) → same worker
- Tasks with dependencies → same worker (simplifies execution)
- Repo analysis: group by file type / directory

**LLM call:** One call to the master LLM with a structured prompt asking for task decomposition. Uses the same `get_llm_for_request()` flow.

**File size:** ~200 lines

---

### 3.4 New File: `backend/agent/worker.py` (CREATE)

**Purpose:** Execute assigned sub-tasks in isolation. Each worker is a self-contained agent.

```python
"""Worker agent: executes assigned sub-tasks in isolation."""

import asyncio
from agent.state import WorkerState

def worker_node(state: WorkerState) -> dict:
    """
    Execute all assigned sub-tasks for this worker.
    
    1. For each assigned task, generate a partial plan
    2. Combine partial plans into worker's sub_plan
    3. Return results (sub_plan, thinking, errors)
    
    Isolation guarantees:
    - Worker only sees its own WorkerState
    - No access to other workers' results
    - Own LLM context (no cross-contamination)
    """
```

**Worker execution strategies by task type:**
```python
_TASK_HANDLERS = {
    "component_analysis": _handle_component_analysis,
    "relationship_mapping": _handle_relationship_mapping,
    "layer_design": _handle_layer_design,
    "repo_file_analysis": _handle_repo_file_analysis,
    "repo_structure_analysis": _handle_repo_structure_analysis,
    "tech_stack_detection": _handle_tech_stack_detection,
}
```

Each handler:
1. Constructs a focused LLM prompt for its sub-task
2. Calls the LLM (via `get_llm_for_request`)
3. Parses and validates the partial result
4. Returns a partial plan (components, relationships, layers, etc.)

**Isolation enforcement:**
- Workers receive a `WorkerState` (not `AgentState`)
- No imports/access to shared state
- Each worker gets a fresh LLM context (no conversation history from other workers)
- Error in one worker doesn't affect others

**File size:** ~250 lines

---

### 3.5 New File: `backend/agent/aggregator.py` (CREATE)

**Purpose:** Merge all worker results into a single coherent diagram plan.

```python
"""Aggregator: merges worker results into a unified diagram plan."""

def aggregator_node(state: AgentState) -> dict:
    """
    1. Collect all worker_results
    2. Merge partial plans based on diagram_type
    3. Deduplicate components (by name similarity)
    4. Resolve relationship conflicts
    5. Validate merged plan with diagram_validator
    6. Return final diagram_plan
    
    Handles partial failures:
    - If some workers failed, merge available results
    - Add warnings about missing sections
    """
```

**Merge strategies by diagram type:**

| Diagram Type | Merge Strategy |
|-------------|---------------|
| `architecture` | Union of components, deduplicate by name, merge connections |
| `hld` | Merge layers (union per layer), merge flows |
| `class` | Union of classes, merge relationships, check for name conflicts |
| `sequence` | Order messages by worker priority, merge participants |
| `component` | Union of components, merge dependencies |

**Deduplication logic:**
```python
def _deduplicate_components(all_components: list[dict]) -> list[dict]:
    """
    Remove near-duplicate components using name similarity.
    E.g., "Auth Service" and "Authentication Service" → keep one.
    Uses simple string matching (Levenshtein ratio > 0.8).
    """
```

**Conflict resolution:**
- If two workers define the same component with different types → use the one from the higher-priority worker
- If relationship endpoints reference components from different workers → create the cross-worker connection

**File size:** ~200 lines

---

### 3.6 Modify File: `backend/agent/__init__.py` (MODIFY)

**Current (94 lines) → Updated (~180 lines)**

**Changes:**

1. **Add multi-agent workflow** alongside existing single-agent workflow
2. **New function `run_multi_agent()`** — parallel execution entry point
3. **New function `run_agent()` updated** — routes to single or multi based on classifier
4. **Keep all existing exports** — backward compatible

```python
"""
ArchitectAI diagram agent: plan + generate from natural language.
Supports single-agent (fast) and multi-agent (complex) modes.
"""
from langgraph.graph import StateGraph, END, Send

from agent.state import AgentState, WorkerState
from agent.planner import planner_node
from agent.generator import generator_node
from agent.master import master_node
from agent.worker import worker_node
from agent.aggregator import aggregator_node
from agent.classifier import classify_complexity
from agent.llm_setup import get_llm_mode
from agent.chat import update_diagram, generate_repo_explanation
from agent.display import format_plan_for_display

# --- Single-agent workflow (existing, unchanged) ---
single_workflow = StateGraph(AgentState)
single_workflow.add_node("planner", planner_node)
single_workflow.add_node("generator", generator_node)
single_workflow.set_entry_point("planner")
single_workflow.add_edge("planner", "generator")
single_workflow.add_edge("generator", END)
single_app = single_workflow.compile()

# --- Multi-agent workflow (new) ---
multi_workflow = StateGraph(AgentState)
multi_workflow.add_node("master", master_node)
multi_workflow.add_node("worker", worker_node)
multi_workflow.add_node("aggregator", aggregator_node)
multi_workflow.add_node("generator", generator_node)

def _route_to_workers(state):
    """Dynamic fan-out: master decides how many workers to spawn."""
    return [
        Send("worker", {
            "worker_id": task["worker_id"],
            "assigned_tasks": [t for t in state["task_plan"] if t["worker_id"] == task["worker_id"]],
            "prompt": state["prompt"],
            "diagram_type": state["diagram_type"],
            "model": state["model"],
            "code_detail_level": state.get("code_detail_level", "small"),
        })
        for task in state["task_plan"]
        # Deduplicate by worker_id (each worker sent once)
        if task["task_id"] == next(
            t["task_id"] for t in state["task_plan"]
            if t["worker_id"] == task["worker_id"]
        )
    ]

multi_workflow.set_entry_point("master")
multi_workflow.add_conditional_edges("master", _route_to_workers)
multi_workflow.add_edge("worker", "aggregator")
multi_workflow.add_edge("aggregator", "generator")
multi_workflow.add_edge("generator", END)
multi_app = multi_workflow.compile()


# Legacy alias for backward compatibility
app = single_app
workflow = single_workflow


def run_agent(
    prompt: str,
    diagram_type: str = "architecture",
    model: str | None = None,
    code_detail_level: str | None = None,
) -> dict:
    """
    Run diagram generation. Auto-selects single or multi-agent mode
    based on prompt complexity.
    """
    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    
    # Classify complexity
    classification = classify_complexity(prompt, diagram_type)
    
    if classification["mode"] == "multi":
        return _run_multi_agent(prompt, diagram_type, model, level, classification)
    else:
        return _run_single_agent(prompt, diagram_type, model, level)


def _run_single_agent(prompt, diagram_type, model, level):
    """Existing single-agent pipeline (unchanged logic)."""
    inputs = {
        "prompt": prompt,
        "messages": [],
        "diagram_type": diagram_type,
        "model": model or "",
        "code_detail_level": level,
    }
    result = single_app.invoke(inputs)
    output = result["json_output"]
    if result.get("diagram_plan"):
        output["diagram_plan"] = result["diagram_plan"]
    output["execution_mode"] = "single"
    return output


def _run_multi_agent(prompt, diagram_type, model, level, classification):
    """New multi-agent pipeline."""
    inputs = {
        "prompt": prompt,
        "messages": [],
        "diagram_type": diagram_type,
        "model": model or "",
        "code_detail_level": level,
        "execution_mode": "multi",
        "task_plan": [],
        "worker_results": {},
        "agent_progress": [],
    }
    result = multi_app.invoke(inputs)
    output = result["json_output"]
    if result.get("diagram_plan"):
        output["diagram_plan"] = result["diagram_plan"]
    output["execution_mode"] = "multi"
    output["complexity"] = classification
    output["agent_progress"] = result.get("agent_progress", [])
    return output
```

**Key design decision:** The existing `run_agent()` API signature is unchanged. Callers (main.py) don't need to change. The function internally decides which pipeline to use.

---

### 3.7 Modify File: `backend/agent/display.py` (MODIFY)

**Changes:** Add formatting for multi-agent progress and task decomposition display.

```python
# Add to existing file:

def format_multi_agent_progress(progress: list[dict]) -> str:
    """Format multi-agent execution progress for display in chat."""
    ...

def format_task_decomposition(task_plan: list[dict]) -> str:
    """Format the master's task decomposition for display."""
    ...
```

**File change:** ~50 additional lines

---

## 4. Phase 2 — Integration with Existing Flows

### 4.1 Modify File: `backend/main.py` (MODIFY)

**Changes are minimal due to backward-compatible `run_agent()` API.**

#### 4.1.1 New Schema: `MultiAgentGenerateRequest`

```python
class MultiAgentGenerateRequest(PromptRequest):
    """Extended request that allows forcing multi-agent mode."""
    force_multi_agent: bool = Field(
        default=False, 
        description="Force multi-agent mode regardless of complexity"
    )
```

#### 4.1.2 New Endpoint: `POST /api/v1/generate-multi` (Optional)

```python
@app.post(f"{API_V1_PREFIX}/generate-multi")
@limiter.limit(RATE_LIMIT_GENERATE)
async def generate_diagram_multi(
    request: Request,
    body: MultiAgentGenerateRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user_from_request),
):
    """
    Generate diagram with explicit multi-agent mode.
    Response includes agent_progress and complexity analysis.
    """
```

#### 4.1.3 Update Existing `/generate` Endpoint

The existing `/generate` endpoint calls `run_agent()` which now auto-selects mode. **No code change needed** for basic functionality. Optionally add `execution_mode` to the response metadata.

#### 4.1.4 New SSE Endpoint: `GET /api/v1/generate-stream` (Phase 3)

```python
@app.get(f"{API_V1_PREFIX}/generate-stream")
async def generate_stream(request: Request, prompt: str, diagram_type: str, model: str = None):
    """
    Server-Sent Events endpoint for real-time multi-agent progress.
    Streams events: master_thinking, worker_started, worker_complete, aggregating, done.
    """
    from sse_starlette.sse import EventSourceResponse
    
    async def event_generator():
        # Yields progress events as the multi-agent pipeline executes
        ...
    
    return EventSourceResponse(event_generator())
```

**New dependency:** `sse-starlette` (add to `requirements.txt`)

#### Summary of `main.py` changes:
| Change | Lines Added | Lines Modified |
|--------|-------------|----------------|
| `MultiAgentGenerateRequest` schema | ~8 | 0 |
| `/generate-multi` endpoint | ~40 | 0 |
| `/generate-stream` SSE endpoint (Phase 3) | ~60 | 0 |
| Response metadata in `/generate` | 0 | ~3 |

---

### 4.2 Modify File: `backend/agent/planner.py` (MINOR MODIFY)

**Changes:** The planner is still used in the single-agent path. No changes needed for Phase 1. In Phase 2, add a helper that workers can reuse:

```python
# Add at bottom of planner.py:

def plan_focused_subset(
    prompt: str,
    focus_area: str,
    diagram_type: str,
    llm_to_use,
    context_str: str,
) -> tuple[dict, str | None]:
    """
    Generate a focused partial plan for a specific domain area.
    Used by worker agents for sub-task execution.
    
    Args:
        focus_area: e.g. "authentication and user management components"
    """
```

**File change:** ~60 additional lines

---

### 4.3 Repo Analysis Multi-Agent Flow (Priority Use Case)

**Current flow in `main.py` `/generate-from-repo`:**
```python
# Sequential (current):
1. raw_summary = analyze_repo(body.repo_url)       # ~5-10s
2. repo_explanation = generate_repo_explanation()    # ~3-5s (LLM call)
3. result = run_agent(repo_prompt, ...)             # ~5-10s (plan + generate)
```

**New flow with multi-agent:**
```python
# Parallel (new):
# Master decomposes repo analysis into:
#   Worker 1: Analyze file structure + detect tech stack
#   Worker 2: Analyze dependencies and API patterns  
#   Worker 3: Generate repo explanation
# All run in parallel → Aggregator merges → Generator produces diagram
```

**Implementation:** The classifier will give repo analysis prompts a high complexity score, routing them to multi-agent. The master's LLM prompt includes repo-specific decomposition instructions.

**Expected speedup:** ~40-60% faster for repo analysis (parallel LLM calls instead of sequential).

---

## 5. Phase 3 — Frontend: Real-Time Progress UI

### 5.1 New File: `frontend/lib/multiAgent.ts` (CREATE)

```typescript
/**
 * Multi-agent API types and SSE connection for real-time progress.
 */

export interface AgentProgress {
  phase: 'classifying' | 'master_thinking' | 'worker_started' | 'worker_complete' | 'aggregating' | 'generating' | 'done';
  timestamp: number;
  worker_id?: string;
  task_description?: string;
  progress_pct?: number;
  thinking?: string;
}

export interface MultiAgentResult {
  // Standard diagram result fields
  mermaid: string;
  versions?: any[];
  diagram_plan?: any;
  
  // Multi-agent specific
  execution_mode: 'single' | 'multi';
  complexity?: {
    mode: string;
    complexity_score: number;
    reason: string;
    estimated_workers: number;
  };
  agent_progress?: AgentProgress[];
}

export function connectToProgressStream(
  prompt: string,
  diagramType: string,
  model: string | null,
  onProgress: (event: AgentProgress) => void,
  onComplete: (result: MultiAgentResult) => void,
  onError: (error: Error) => void,
): () => void {
  // Returns cleanup function
}
```

**File size:** ~80 lines

---

### 5.2 New File: `frontend/components/MultiAgentProgress.tsx` (CREATE)

**A premium, animated progress panel showing:**
- Master thinking phase (with pulsing animation)
- Worker cards (one per worker, showing assigned tasks)
- Real-time status badges (⏳ pending → 🔄 running → ✅ complete → ❌ failed)
- Aggregation phase
- Overall progress bar

**Design:** Glassmorphism cards, staggered entrance animations, live progress indicators.

```tsx
interface MultiAgentProgressProps {
  progress: AgentProgress[];
  isActive: boolean;
}

export function MultiAgentProgress({ progress, isActive }: MultiAgentProgressProps) {
  // Renders the multi-agent execution visualization
}
```

**File size:** ~200 lines

---

### 5.3 Modify File: `frontend/components/Canvas.tsx` (MODIFY)

**Changes:**
1. Import `MultiAgentProgress` component
2. Add `agentProgress` state
3. Conditionally render `MultiAgentProgress` when execution_mode is "multi"
4. Update `handleGenerate` to use SSE stream (Phase 3) or poll for progress

**Lines changed:** ~30 lines modified/added in the existing ~63K file

---

### 5.4 Modify File: `frontend/components/PromptBar.tsx` (MODIFY)

**Changes:**
1. Add optional "Multi-Agent" toggle/badge in the prompt bar
2. Show complexity indicator when user types (debounced client-side heuristic)

**Lines changed:** ~20 lines

---

### 5.5 Modify File: `frontend/lib/api.ts` (MODIFY)

**Changes:**
```typescript
// Add new URL helpers:
export function getGenerateMultiUrl(): string {
  return `${getApiBaseUrl()}/api/v1/generate-multi`;
}

export function getGenerateStreamUrl(): string {
  return `${getApiBaseUrl()}/api/v1/generate-stream`;
}
```

**Lines changed:** ~10 lines

---

## 6. File Change Map

### New Files (CREATE)

| File | Size (est.) | Phase | Description |
|------|------------|-------|-------------|
| `backend/agent/classifier.py` | ~80 lines | 1 | Complexity classifier (single vs multi) |
| `backend/agent/master.py` | ~200 lines | 1 | Master decomposer node |
| `backend/agent/worker.py` | ~250 lines | 1 | Worker execution node |
| `backend/agent/aggregator.py` | ~200 lines | 1 | Result merger + dedup + validator |
| `frontend/lib/multiAgent.ts` | ~80 lines | 3 | Multi-agent types + SSE client |
| `frontend/components/MultiAgentProgress.tsx` | ~200 lines | 3 | Real-time progress UI |

### Modified Files (MODIFY)

| File | Lines Changed (est.) | Phase | What Changes |
|------|---------------------|-------|-------------|
| `backend/agent/state.py` | +20 | 1 | Add `WorkerState`, multi-agent fields to `AgentState` |
| `backend/agent/__init__.py` | +90 (refactor) | 1 | Multi-agent workflow, routing, `run_multi_agent()` |
| `backend/agent/planner.py` | +60 | 2 | Add `plan_focused_subset()` for workers |
| `backend/agent/display.py` | +50 | 2 | Multi-agent progress formatting |
| `backend/main.py` | +110 | 2-3 | New schemas, `/generate-multi`, `/generate-stream` |
| `backend/requirements.txt` | +1 | 3 | Add `sse-starlette` |
| `backend/config.py` | +6 | 1 | Multi-agent config vars |
| `frontend/lib/api.ts` | +10 | 3 | New URL helpers |
| `frontend/components/Canvas.tsx` | +30 | 3 | Progress state + `MultiAgentProgress` render |
| `frontend/components/PromptBar.tsx` | +20 | 3 | Multi-agent toggle |

### Untouched Files
The following files require **no changes:**
- `backend/agent/parser.py` — workers reuse as-is
- `backend/agent/thinking.py` — workers reuse as-is
- `backend/agent/layouts.py` — generator reuses as-is
- `backend/agent/chat.py` — single-agent only (update diagram)
- `backend/diagram_validator.py` — aggregator calls existing validators
- `backend/agent/generator.py` — takes plan, generates mermaid (unchanged)
- `backend/rag.py` — workers call as-is for context
- `backend/github_repo.py` — repo analysis unchanged
- `backend/routers/*` — no changes needed
- `backend/auth.py` — no changes
- `backend/database.py` — no changes
- All frontend `uml/` components — render layer unchanged

---

## 7. API Contract Changes

### Response Schema Extension

All `/generate` responses now include:
```json
{
  // ... existing fields (mermaid, versions, diagram_plan, etc.) ...
  
  "execution_mode": "single",           // NEW: always present
  "complexity": null,                     // NEW: only for multi-agent
  "agent_progress": []                    // NEW: only for multi-agent
}
```

### Multi-Agent Response Example
```json
{
  "mermaid": "graph TD\n  A[Auth] --> B[API]\n  ...",
  "versions": [...],
  "diagram_plan": {...},
  "execution_mode": "multi",
  "complexity": {
    "mode": "multi",
    "complexity_score": 7,
    "reason": "Complex microservices prompt with 8+ service keywords",
    "estimated_workers": 3
  },
  "agent_progress": [
    {"phase": "master_thinking", "timestamp": 1708400000, "thinking": "Decomposing into 3 worker tasks..."},
    {"phase": "worker_started", "timestamp": 1708400001, "worker_id": "w1", "task_description": "Auth + User services"},
    {"phase": "worker_started", "timestamp": 1708400001, "worker_id": "w2", "task_description": "Payment + Order services"},
    {"phase": "worker_started", "timestamp": 1708400001, "worker_id": "w3", "task_description": "Data layer + Infrastructure"},
    {"phase": "worker_complete", "timestamp": 1708400005, "worker_id": "w1"},
    {"phase": "worker_complete", "timestamp": 1708400006, "worker_id": "w2"},
    {"phase": "worker_complete", "timestamp": 1708400004, "worker_id": "w3"},
    {"phase": "aggregating", "timestamp": 1708400006},
    {"phase": "generating", "timestamp": 1708400007},
    {"phase": "done", "timestamp": 1708400008, "progress_pct": 100}
  ]
}
```

### SSE Stream Events (Phase 3)
```
event: progress
data: {"phase": "master_thinking", "thinking": "Analyzing prompt complexity..."}

event: progress  
data: {"phase": "worker_started", "worker_id": "w1", "task_description": "Analyzing auth components"}

event: progress
data: {"phase": "worker_complete", "worker_id": "w1", "progress_pct": 33}

event: result
data: {"mermaid": "...", "execution_mode": "multi", ...}
```

---

## 8. Error Handling & Resilience

### Worker Failure Modes

| Scenario | Handling | User Sees |
|----------|----------|-----------|
| Worker LLM call fails (timeout/error) | Retry once, then mark failed | Partial diagram + warning toast |
| Worker returns invalid JSON | Parse best-effort, log error | Diagram without that section |
| All workers fail | Fallback to single-agent pipeline | Standard diagram (as if multi-agent never ran) |
| Master decomposition fails | Skip multi-agent, use single-agent | Standard diagram |
| Aggregator merge conflict | Use highest-priority worker's version | Complete diagram (one version wins) |

### Fallback Chain
```
Multi-Agent → (failure) → Single-Agent → (failure) → Mock Plan → (failure) → Error 500
```

### Implementation in `aggregator.py`:
```python
def aggregator_node(state: AgentState) -> dict:
    worker_results = state.get("worker_results", {})
    
    # Count successes
    successes = {wid: r for wid, r in worker_results.items() if not r.get("error")}
    failures = {wid: r for wid, r in worker_results.items() if r.get("error")}
    
    if not successes:
        # ALL workers failed → fallback to single-agent
        logger.warning("All workers failed, falling back to single-agent")
        from agent.planner import planner_node
        return planner_node(state)
    
    if failures:
        logger.warning("Partial worker failures: %s", list(failures.keys()))
    
    # Merge successful results
    merged_plan = _merge_plans(successes, state["diagram_type"])
    ...
```

---

## 9. Configuration & Environment

### New Environment Variables

Add to `backend/config.py`:

```python
# Multi-Agent Configuration
MULTI_AGENT_ENABLED = os.getenv("MULTI_AGENT_ENABLED", "true").lower() == "true"
MULTI_AGENT_COMPLEXITY_THRESHOLD = int(os.getenv("MULTI_AGENT_COMPLEXITY_THRESHOLD", "5"))
MULTI_AGENT_MAX_WORKERS = int(os.getenv("MULTI_AGENT_MAX_WORKERS", "5"))
MULTI_AGENT_WORKER_TIMEOUT = int(os.getenv("MULTI_AGENT_WORKER_TIMEOUT", "30"))  # seconds
MULTI_AGENT_WORKER_MODEL = os.getenv("MULTI_AGENT_WORKER_MODEL", "")  # Optional cheaper model for workers
```

Add to `backend/.env.example`:
```env
# Multi-Agent Mode
MULTI_AGENT_ENABLED=true
MULTI_AGENT_COMPLEXITY_THRESHOLD=5      # 1-10, prompts scoring >= this use multi-agent
MULTI_AGENT_MAX_WORKERS=5               # Maximum parallel workers
MULTI_AGENT_WORKER_TIMEOUT=30           # Per-worker timeout in seconds
MULTI_AGENT_WORKER_MODEL=               # Optional: use cheaper model for workers (empty = same as master)
```

---

## 10. Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|--------------|
| `tests/test_classifier.py` | Complexity scoring, mode selection |
| `tests/test_master.py` | Task decomposition, grouping logic |
| `tests/test_worker.py` | Task execution, isolation guarantees |
| `tests/test_aggregator.py` | Plan merging, dedup, conflict resolution |
| `tests/test_multi_agent_e2e.py` | Full pipeline: prompt → multi-agent → diagram |

### Key Test Cases

```python
# test_classifier.py
def test_simple_prompt_single_mode():
    result = classify_complexity("draw a login flow", "flowchart")
    assert result["mode"] == "single"

def test_complex_prompt_multi_mode():
    result = classify_complexity(
        "Design a microservices architecture for an e-commerce platform with "
        "auth, payment, inventory, order management, notification, and search services",
        "architecture"
    )
    assert result["mode"] == "multi"
    assert result["estimated_workers"] >= 2

# test_worker.py
def test_worker_isolation():
    """Workers should not share state."""
    w1 = WorkerState(worker_id="w1", assigned_tasks=[...], ...)
    w2 = WorkerState(worker_id="w2", assigned_tasks=[...], ...)
    r1 = worker_node(w1)
    r2 = worker_node(w2)
    # Verify no cross-contamination
    assert r1["worker_id"] != r2["worker_id"]

# test_aggregator.py  
def test_merge_deduplicates_components():
    results = {
        "w1": {"sub_plan": {"components": [{"name": "Auth Service", "type": "auth"}]}},
        "w2": {"sub_plan": {"components": [{"name": "Authentication Service", "type": "auth"}]}},
    }
    merged = _merge_plans(results, "architecture")
    assert len(merged["components"]) == 1  # Deduped

def test_fallback_on_all_workers_fail():
    results = {
        "w1": {"error": "LLM timeout"},
        "w2": {"error": "Invalid JSON"},
    }
    # Should fall back to single-agent planner
    ...
```

---

## 11. Migration & Rollout Plan

### Step-by-Step Implementation Order

```
Week 1: Phase 1 — Core Infrastructure
├── Day 1: state.py changes + classifier.py
├── Day 2: master.py (task decomposition)
├── Day 3: worker.py (task execution)
├── Day 4: aggregator.py (merge + validate)
├── Day 5: __init__.py (multi-agent workflow wiring)
│
Week 2: Phase 2 — Integration & Testing
├── Day 1: planner.py (plan_focused_subset helper)
├── Day 2: main.py (new endpoints, response metadata)
├── Day 3: config.py + .env changes
├── Day 4: Unit tests (classifier, master, worker, aggregator)
├── Day 5: E2E tests + bug fixes
│
Week 3: Phase 3 — Frontend UI
├── Day 1: multiAgent.ts (types + SSE client)
├── Day 2: MultiAgentProgress.tsx (progress component)
├── Day 3: Canvas.tsx + PromptBar.tsx integration
├── Day 4: Polish animations + error states
├── Day 5: Full integration testing
```

### Feature Flag Rollout

```python
# config.py — allows gradual rollout
MULTI_AGENT_ENABLED = os.getenv("MULTI_AGENT_ENABLED", "true").lower() == "true"

# In agent/__init__.py:
if not MULTI_AGENT_ENABLED:
    classification["mode"] = "single"  # Force single-agent
```

- **Dev:** `MULTI_AGENT_ENABLED=true` (default)
- **Staging:** `MULTI_AGENT_ENABLED=true`  
- **Production:** Start with `MULTI_AGENT_ENABLED=false`, enable after validation

### Backward Compatibility Guarantee

| API | Change | Breaking? |
|-----|--------|-----------|
| `POST /api/v1/generate` | Adds `execution_mode` to response | ❌ No (additive) |
| `POST /api/v1/update` | No change | ❌ No |
| `POST /api/v1/plan` | No change | ❌ No |
| `POST /api/v1/generate-from-plan` | No change | ❌ No |
| `POST /api/v1/generate-from-repo` | Adds `execution_mode` to response | ❌ No (additive) |
| `POST /api/v1/generate-multi` | New endpoint | ❌ No (additive) |
| `GET /api/v1/generate-stream` | New endpoint | ❌ No (additive) |

**Zero breaking changes.** All existing endpoints continue to work identically. Multi-agent is opt-in via complexity scoring and can be disabled with a single env var.

---

## Appendix A: Dependency Check

### Current Dependencies That Support This

| Package | Version | Used For |
|---------|---------|----------|
| `langgraph` | ≥0.2.0 | `Send()` API for dynamic fan-out ✅ |
| `langchain-core` | ≥0.3.0 | LLM messages, prompt construction ✅ |
| `langchain-openai` | ≥0.2.0 | OpenRouter/OpenAI LLM calls ✅ |
| `fastapi` | ≥0.115.0 | Async endpoints, SSE support ✅ |

### New Dependencies

| Package | Version | Used For |
|---------|---------|----------|
| `sse-starlette` | ≥2.0.0 | Server-Sent Events for `/generate-stream` (Phase 3 only) |

---

## Appendix B: LLM Cost Analysis

### Current (Single-Agent)
- 1 LLM call for planning (~500 input tokens, ~300 output tokens)
- Total: ~800 tokens per diagram

### Multi-Agent
- 1 master call (~600 input, ~400 output) = ~1000 tokens
- N worker calls (~400 input, ~250 output each) = ~650 × N tokens
- For N=3 workers: ~1000 + 1950 = **~2,950 tokens** (~3.7x increase)

### Mitigation
1. **Only activate for complex prompts** (classifier threshold)
2. **Use cheaper models for workers** (`MULTI_AGENT_WORKER_MODEL` env var)
3. **Cache worker results** for similar sub-tasks (future optimization)
4. **Parallel execution** means wall-clock time may actually decrease despite more tokens

---

*End of Implementation Plan*
