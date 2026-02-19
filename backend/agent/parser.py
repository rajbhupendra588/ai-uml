"""JSON extraction and plan validation with optional LLM retry."""
import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from diagram_validator import validate_and_repair, get_valid_plan

logger = logging.getLogger("architectai.agent.parser")


def extract_json(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks and extra text."""
    if not text or not text.strip():
        raise ValueError("Empty response from LLM")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if code_block_match:
        try:
            return json.loads(code_block_match.group(1))
        except json.JSONDecodeError:
            pass

    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from response: {text[:200]}")


def validate_and_retry(
    diagram_type: str,
    plan: dict,
    prompt: str,
    llm_to_use,
    fix_system_hint: str,
) -> tuple[dict, bool, bool]:
    """
    Validate diagram plan; if invalid, attempt one LLM retry with error feedback.
    Returns (final_plan, validation_passed, retry_used).
    """
    result = validate_and_repair(diagram_type, plan)
    if result.is_valid:
        logger.info(
            "Diagram validation passed",
            extra={"diagram_type": diagram_type, "retry_used": False},
        )
        return (plan, True, False)

    if llm_to_use and result.errors:
        try:
            fix_prompt = f"""The following JSON failed validation. Return ONLY the corrected JSON, no markdown or explanation.

Validation errors:
{chr(10).join('- ' + e for e in result.errors[:8])}

Current (invalid) JSON:
{json.dumps(plan, indent=2)[:2000]}

User's original request: {prompt[:300]}

{fix_system_hint}"""
            messages = [
                SystemMessage(content="You fix JSON to satisfy the validation errors. Output ONLY valid JSON."),
                HumanMessage(content=fix_prompt),
            ]
            response = llm_to_use.invoke(messages)
            retry_plan = extract_json(response.content)
            retry_result = validate_and_repair(diagram_type, retry_plan)
            if retry_result.is_valid:
                logger.info(
                    "Diagram validation passed after retry",
                    extra={"diagram_type": diagram_type, "retry_used": True},
                )
                return (retry_plan, True, True)
        except Exception as e:
            logger.warning("Validation retry failed: %s", e, extra={"diagram_type": diagram_type})

    final = get_valid_plan(diagram_type, plan)
    logger.info(
        "Diagram plan used repaired/fallback",
        extra={"diagram_type": diagram_type, "errors": result.errors[:3]},
    )
    return (final, False, True)
