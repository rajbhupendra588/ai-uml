"""
ArchitectAI diagram agent: plan + generate from natural language.
Public API: run_agent, update_diagram, run_plan_only, run_generator_from_plan,
generate_repo_explanation, format_plan_for_display, get_llm_mode.
"""
from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.planner import planner_node
from agent.generator import generator_node
from agent.llm_setup import get_llm_mode
from agent.chat import update_diagram, generate_repo_explanation
from agent.display import format_plan_for_display

# Build compiled workflow (used by run_agent, run_plan_only, run_generator_from_plan)
workflow = StateGraph(AgentState)
workflow.add_node("planner", planner_node)
workflow.add_node("generator", generator_node)
workflow.set_entry_point("planner")
workflow.add_edge("planner", "generator")
workflow.add_edge("generator", END)
app = workflow.compile()


def run_agent(
    prompt: str,
    diagram_type: str = "architecture",
    model: str | None = None,
    code_detail_level: str | None = None,
) -> dict:
    """Run the full plan + generate pipeline. Returns json_output with mermaid, versions, etc."""
    level = (code_detail_level or "small").lower()
    if level not in ("small", "complete"):
        level = "small"
    inputs = {
        "prompt": prompt,
        "messages": [],
        "diagram_type": diagram_type,
        "model": model or "",
        "code_detail_level": level,
    }
    result = app.invoke(inputs)
    output = result["json_output"]
    if result.get("diagram_plan"):
        output["diagram_plan"] = result["diagram_plan"]
    return output


def run_plan_only(
    prompt: str,
    diagram_type: str = "architecture",
    model: str | None = None,
) -> dict:
    """Run only the planner; returns diagram_plan for preview/confirmation."""
    state = {"prompt": prompt, "messages": [], "diagram_type": diagram_type, "model": model or ""}
    out = planner_node(state)
    return out["diagram_plan"]


def run_generator_from_plan(
    diagram_plan: dict,
    diagram_type: str,
    code_detail_level: str = "small",
) -> dict:
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


__all__ = [
    "get_llm_mode",
    "run_agent",
    "update_diagram",
    "run_plan_only",
    "run_generator_from_plan",
    "generate_repo_explanation",
    "format_plan_for_display",
    "AgentState",
    "app",
]
