"""LLM initialization and request-scoped model selection."""
import logging
import os

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("architectai.agent.llm")

try:
    from langchain_openai import ChatOpenAI

    if os.getenv("OPENROUTER_API_KEY"):
        logger.info("Using OpenRouter LLM")
        llm = ChatOpenAI(
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            model=os.getenv("OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free"),
            temperature=0,
        )
        has_llm = True
    elif os.getenv("OPENAI_API_KEY"):
        logger.info("Using OpenAI LLM")
        llm = ChatOpenAI(model="gpt-4-turbo", temperature=0)
        has_llm = True
    else:
        raise ValueError("No API Key")
except Exception:
    logger.warning("No valid API key (OpenAI or OpenRouter). Using mock mode.")
    llm = None
    has_llm = False


def get_llm_mode() -> str:
    """Which LLM mode is active (for /health and debugging)."""
    if has_llm and os.getenv("OPENROUTER_API_KEY"):
        return "openrouter"
    if has_llm and os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "mock"


def get_llm_for_request(model: str | None):
    """Return LLM to use: bound with selected model if OpenRouter and model given."""
    if not has_llm:
        return None
    if model and os.getenv("OPENROUTER_API_KEY"):
        return llm.bind(model=model)
    return llm
