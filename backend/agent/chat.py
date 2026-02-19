"""Chat-mode Mermaid generation, diagram update, and repo explanation."""
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from agent.llm_setup import get_llm_for_request, has_llm, llm

logger = logging.getLogger("architectai.agent.chat")


def generate_chat_mermaid(prompt: str, llm_to_use) -> str:
    """
    Generate generic Mermaid code for 'Chat' mode.
    Allows user to ask for any diagram type supported by Mermaid.
    """
    if not llm_to_use:
        return "graph TD\n    A[Mock Chat]\n    B[No LLM Configured]\n    A --> B"

    system_prompt = """You are a Mermaid.js expert. Generate VALID Mermaid code based on the user's request.
Rules:
1. Return ONLY the Mermaid code. No markdown fences (```mermaid), no explanations.
2. If the user asks for a specific diagram type (Sequence, Class, State, Git, Gantt, Pie, etc.), use that.
3. If the request is vague, infer the best diagram type.
4. Ensure syntax is correct and up-to-date.
5. Do not include 'mermaid' keyword at the start if it's not part of the syntax (e.g. use 'graph TD', 'sequenceDiagram', etc.).
"""
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    try:
        response = llm_to_use.invoke(messages)
        content = response.content.strip()
        if content.startswith("```mermaid"):
            content = content[10:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()
    except Exception as e:
        logger.exception("Chat generation error: %s", e)
        return "graph TD\n    Error[Generation Failed]\n    Details[Check Logs]"


def update_diagram(current_mermaid: str, prompt: str, model: str | None = None) -> dict:
    """
    Update an existing diagram based on user refinement prompt.
    Takes current Mermaid code and user's update request, returns updated diagram.
    """
    llm_to_use = get_llm_for_request(model) if model else get_llm_for_request(None)
    if not llm_to_use:
        return {
            "mermaid": current_mermaid,
            "nodes": [],
            "edges": [],
            "versions": [{"code": current_mermaid, "layout": "Default", "direction": "TB", "description": "No LLM configured"}],
            "selectedVersion": 0,
        }

    system_prompt = """You are a Mermaid.js expert. The user has an existing diagram and wants to update it.
Rules:
1. Return ONLY the updated Mermaid code. No markdown fences (```mermaid), no explanations.
2. Keep the same diagram type (flowchart, sequenceDiagram, classDiagram, etc.) unless the user explicitly asks to change it.
3. Apply the user's requested changes to the existing diagram. Add, remove, or modify elements as requested.
4. Preserve structure and styling that the user did not ask to change.
5. Ensure syntax is valid and up-to-date."""
    user_prompt = f"""Current diagram:
```mermaid
{current_mermaid}
```

User's update request: {prompt}

Return the updated Mermaid diagram code only:"""
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    try:
        response = llm_to_use.invoke(messages)
        content = response.content.strip()
        if content.startswith("```mermaid"):
            content = content[10:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        updated_code = content.strip()
        return {
            "mermaid": updated_code,
            "nodes": [],
            "edges": [],
            "versions": [{"code": updated_code, "layout": "Default", "direction": "TB", "description": "Updated from chat"}],
            "selectedVersion": 0,
        }
    except Exception as e:
        logger.exception("Diagram update error: %s", e)
        return {
            "mermaid": current_mermaid,
            "nodes": [],
            "edges": [],
            "versions": [{"code": current_mermaid, "layout": "Default", "direction": "TB", "description": "Update failed, kept original"}],
            "selectedVersion": 0,
        }


def generate_repo_explanation(raw_summary: str, model: str | None = None) -> str:
    """
    Generate a user-friendly, detailed explanation of a GitHub repository from its raw analysis.
    Used when creating diagrams from repos: show in chat so users understand the repo first.
    """
    llm_to_use = get_llm_for_request(model) if model else get_llm_for_request(None)
    if not has_llm or not llm_to_use:
        intro = raw_summary[:1500].strip()
        if len(raw_summary) > 1500:
            intro += "\n\n... (further analysis used for diagram generation)"
        return intro

    system = """You are a technical analyst. Given raw repository analysis (structure, config files, README, source snippets), write a clear, concise explanation for a developer.

Your explanation should:
1. Describe what the repository does (purpose, main features, tech stack)
2. Summarize the architecture and key components (backend, frontend, APIs, etc.)
3. Note important integrations, deployment setup, or patterns
4. Be 150-400 words, well-structured with short paragraphs
5. Use plain language—no raw JSON or code dumps
6. Focus on what a developer would want to know before looking at the code"""
    prompt = f"""Analyze this repository and write a detailed explanation:\n\n{raw_summary[:18000]}"""
    messages = [SystemMessage(content=system), HumanMessage(content=prompt)]
    try:
        response = (llm_to_use or llm).invoke(messages)
        text = (response.content or "").strip()
        return text[:4000] if text else raw_summary[:1500]
    except Exception as e:
        logger.warning("repo_explanation_llm_failed: %s", e)
        return raw_summary[:1500] + "\n\n(LLM explanation unavailable; diagram based on raw analysis.)"
