"""
ArchitectAI diagram agent: plan + generate from natural language.
Public API: run_agent, update_diagram, run_plan_only, run_generator_from_plan,
generate_repo_explanation, format_plan_for_display, get_llm_mode.
"""
import asyncio
import copy
import hashlib
import logging

from agent.state import AgentState
from agent.planner import planner_node
from agent.generator import generator_node
from agent.llm_setup import get_llm_mode
from agent.chat import update_diagram, generate_repo_explanation
from agent.display import format_plan_for_display

logger = logging.getLogger("architectai.agent")

# --- Response cache (in-memory LRU, bounded to 256 entries) ---
_CACHE_MAX = 256
_cache: dict[str, dict] = {}
_cache_order: list[str] = []


def _cache_key(prompt: str, diagram_type: str, model: str, code_detail_level: str) -> str:
    raw = f"{diagram_type}:{model}:{code_detail_level}:{prompt}"
    return hashlib.md5(raw.encode()).hexdigest()


def _cache_get(key: str) -> dict | None:
    val = _cache.get(key)
    return copy.deepcopy(val) if val is not None else None


def _cache_set(key: str, value: dict) -> None:
    if key in _cache:
        _cache_order.remove(key)
    elif len(_cache) >= _CACHE_MAX:
        evict = _cache_order.pop(0)
        _cache.pop(evict, None)
    _cache[key] = value
    _cache_order.append(key)


async def run_agent(
    prompt: str,
    diagram_type: str = "architecture",
    model: str | None = None,
    code_detail_level: str | None = None,
) -> dict:
    """Run the full plan + generate pipeline. Returns json_output with mermaid, versions, etc."""
    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    model_key = model or ""

    cache_key = _cache_key(prompt, diagram_type, model_key, level)
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug("cache_hit | diagram_type=%s", diagram_type)
        return cached

    state: AgentState = {
        "prompt": prompt,
        "messages": [],
        "diagram_type": diagram_type,
        "model": model_key,
        "code_detail_level": level,
    }

    plan_out = await planner_node(state)
    gen_state = {**state, **plan_out}
    gen_out = await generator_node(gen_state)

    output = gen_out["json_output"]
    if plan_out.get("diagram_plan"):
        output["diagram_plan"] = plan_out["diagram_plan"]

    _cache_set(cache_key, copy.deepcopy(output))
    return output


async def run_plan_only(
    prompt: str,
    diagram_type: str = "architecture",
    model: str | None = None,
) -> dict:
    """Run only the planner; returns diagram_plan for preview/confirmation."""
    state: AgentState = {
        "prompt": prompt,
        "messages": [],
        "diagram_type": diagram_type,
        "model": model or "",
        "code_detail_level": "small",
    }
    out = await planner_node(state)
    return out["diagram_plan"]


def run_generator_from_plan(
    diagram_plan: dict,
    diagram_type: str,
    code_detail_level: str = "small",
) -> dict:
    """Generate diagram output from an existing plan (no LLM call — pure compute)."""
    import asyncio
    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    state: AgentState = {
        "diagram_plan": diagram_plan,
        "diagram_type": diagram_type,
        "messages": [],
        "prompt": "",
        "model": "",
        "code_detail_level": level,
    }

    async def _run():
        out = await generator_node(state)
        return out["json_output"]

    result = asyncio.run(_run())
    result["diagram_plan"] = diagram_plan
    return result


async def run_agent_streaming(
    prompt: str,
    diagram_type: str = "architecture",
    model: str | None = None,
    code_detail_level: str | None = None,
):
    """
    Async generator that yields SSE token strings from the planner LLM, then yields
    the final structured result dict — all from a single LLM invocation.

    Yields:
        str  — raw token text while the planner is streaming
        dict — the complete json_output when the pipeline finishes
    """
    from agent.llm_setup import get_llm_for_request, has_llm
    from agent.planner import _retriever, _plan_mock_architecture, build_architecture_system_prompt, build_hld_system_prompt
    from agent.parser import extract_json, validate_and_retry
    from langchain_core.messages import HumanMessage, SystemMessage

    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    model_key = model or ""

    # Check cache first — no streaming needed for a cache hit
    cache_key = _cache_key(prompt, diagram_type, model_key, level)
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug("cache_hit (stream) | diagram_type=%s", diagram_type)
        yield cached
        return

    llm_to_use = get_llm_for_request(model_key) if model_key else get_llm_for_request(None)

    # --- Planner with streaming ---
    diagram_plan: dict = {}

    if diagram_type == "chat":
        diagram_plan = {"prompt": prompt, "type": "chat"}

    elif diagram_type not in ("architecture", "hld") and has_llm and llm_to_use:
        # UML types: use the same type-specific system prompt that plan_uml uses,
        # stream tokens while collecting, then parse JSON from the full response.
        from uml_flow import plan_uml
        _UML_SYSTEM_PROMPTS: dict[str, str] = {}
        try:
            from uml_flow import (
                CLASS_SYSTEM_PROMPT, SEQUENCE_SYSTEM_PROMPT, USECASE_SYSTEM_PROMPT,
                ACTIVITY_SYSTEM_PROMPT, FLOWCHART_SYSTEM_PROMPT, STATE_SYSTEM_PROMPT,
                COMPONENT_SYSTEM_PROMPT, DEPLOYMENT_SYSTEM_PROMPT, MINDTREE_SYSTEM_PROMPT,
            )
            _UML_SYSTEM_PROMPTS = {
                "class": CLASS_SYSTEM_PROMPT, "sequence": SEQUENCE_SYSTEM_PROMPT,
                "usecase": USECASE_SYSTEM_PROMPT, "activity": ACTIVITY_SYSTEM_PROMPT,
                "flowchart": FLOWCHART_SYSTEM_PROMPT, "state": STATE_SYSTEM_PROMPT,
                "component": COMPONENT_SYSTEM_PROMPT, "deployment": DEPLOYMENT_SYSTEM_PROMPT,
                "mindtree": MINDTREE_SYSTEM_PROMPT,
            }
        except ImportError:
            pass

        sys_prompt = _UML_SYSTEM_PROMPTS.get(diagram_type)
        if sys_prompt:
            raw_tokens: list[str] = []
            async for chunk in llm_to_use.astream(
                [SystemMessage(content=sys_prompt), HumanMessage(content=prompt)]
            ):
                token = getattr(chunk, "content", "") or ""
                if token:
                    raw_tokens.append(token)
                    yield token
            try:
                diagram_plan = extract_json("".join(raw_tokens))
            except Exception as e:
                logger.warning("uml_streaming_parse_failed (%s): %s — falling back to ainvoke", diagram_type, e)
                diagram_plan = await plan_uml(diagram_type, prompt, llm_to_use)
        else:
            # Unknown UML type — fall back to non-streaming ainvoke path
            diagram_plan = await plan_uml(diagram_type, prompt, llm_to_use)

    elif has_llm and llm_to_use:
        # Architecture / HLD: use the shared prompt builders (same as planner_node)
        context_parts = _retriever.search(prompt, top_k=5)
        context_str = "\n- ".join(context_parts) if context_parts else "Use industry best practices."

        if diagram_type == "hld":
            sys_content = build_hld_system_prompt(prompt, context_str)
        else:
            sys_content = build_architecture_system_prompt(prompt, context_str)

        raw_tokens: list[str] = []
        async for chunk in llm_to_use.astream(
            [SystemMessage(content=sys_content), HumanMessage(content=prompt)]
        ):
            token = getattr(chunk, "content", "") or ""
            if token:
                raw_tokens.append(token)
                yield token

        try:
            diagram_plan = extract_json("".join(raw_tokens))
            if diagram_type == "hld":
                diagram_plan["type"] = "hld"
            diagram_plan, _, _ = await validate_and_retry(
                diagram_type, diagram_plan, prompt, llm_to_use,
                "Keep required keys and structure."
            )
        except Exception as e:
            logger.warning("streaming_plan_parse_failed: %s — falling back to ainvoke", e)
            from agent.planner import planner_node
            state_tmp: AgentState = {
                "prompt": prompt, "messages": [], "diagram_type": diagram_type,
                "model": model_key, "code_detail_level": level,
            }
            plan_out = await planner_node(state_tmp)
            diagram_plan = plan_out["diagram_plan"]

    else:
        diagram_plan = _plan_mock_architecture(prompt)

    # --- Generator (pure compute, no LLM) ---
    state: AgentState = {
        "prompt": prompt,
        "messages": [],
        "diagram_type": diagram_type,
        "model": model_key,
        "code_detail_level": level,
        "diagram_plan": diagram_plan,
    }
    gen_out = await generator_node(state)
    output = gen_out["json_output"]
    output["diagram_plan"] = diagram_plan

    _cache_set(cache_key, copy.deepcopy(output))
    yield copy.deepcopy(output)


__all__ = [
    "get_llm_mode",
    "run_agent",
    "run_agent_streaming",
    "update_diagram",
    "run_plan_only",
    "run_generator_from_plan",
    "generate_repo_explanation",
    "format_plan_for_display",
    "AgentState",
]
