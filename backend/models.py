"""
Available OpenRouter models for user selection.
"""
# id = OpenRouter model id; name = short label for UI
AVAILABLE_MODELS = [
    {"id": "arcee-ai/trinity-large-preview:free", "name": "Trinity (default)"},
    {"id": "tngtech/deepseek-r1t-chimera:free", "name": "DeepSeek R1 Chimera"},
    {"id": "deepseek/deepseek-r1-0528:free", "name": "DeepSeek R1 0528"},
    {"id": "nvidia/nemotron-3-nano-30b-a3b:free", "name": "NVIDIA Nemotron 3 Nano"},
    {"id": "openai/gpt-oss-120b:free", "name": "GPT-OSS 120B"},
]

DEFAULT_MODEL_ID = "arcee-ai/trinity-large-preview:free"
