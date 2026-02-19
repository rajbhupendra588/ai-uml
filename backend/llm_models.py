"""
Available OpenRouter models for user selection.
"""
# id = OpenRouter model id; name = short label for UI
AVAILABLE_MODELS = [
    {"id": "arcee-ai/trinity-large-preview:free", "name": "Trinity (default)"},
    {"id": "deepseek/deepseek-r1-0528:free", "name": "DeepSeek R1 0528"},
    {"id": "stepfun/step-3.5-flash:free", "name": "StepFun 3.5 Flash"},
    {"id": "nvidia/nemotron-nano-9b-v2:free", "name": "NVIDIA Nemotron 9B v2"},
    {"id": "nvidia/nemotron-nano-12b-v2-vl:free", "name": "NVIDIA Nemotron 12B v2 VL"},
    {"id": "google/gemma-3-27b-it:free", "name": "Gemma 3 27B IT"},
    {"id": "liquid/lfm-2.5-1.2b-thinking:free", "name": "Liquid LFM 2.5 1.2B Thinking"},
    {"id": "google/gemma-3n-e4b-it:free", "name": "Gemma 3N 4B IT"},
    {"id": "google/gemma-3-4b-it:free", "name": "Gemma 3 4B IT"},
    {"id": "google/gemma-3-12b-it:free", "name": "Gemma 3 12B IT"},
]

DEFAULT_MODEL_ID = "arcee-ai/trinity-large-preview:free"
