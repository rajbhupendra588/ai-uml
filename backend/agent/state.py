"""Agent state type for the LangGraph workflow."""
from typing import TypedDict, List


class AgentState(TypedDict):
    messages: List[str]
    prompt: str
    diagram_type: str
    model: str
    diagram_plan: dict
    json_output: dict
    code_detail_level: str  # "small" | "complete"
