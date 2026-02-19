"""
Available OpenRouter models for user selection.
"""
# id = OpenRouter model id; name = short label for UI
AVAILABLE_MODELS = [
    # Default / Existing
    {"id": "arcee-ai/trinity-large-preview:free", "name": "Trinity (default)"},
    
    # User requested additions (sorted roughly by provider/family or just added)
    {"id": "openai/gpt-oss-120b:free", "name": "GPT-OSS 120B"},
    {"id": "deepseek/deepseek-r1-0528:free", "name": "DeepSeek R1 0528"},
    {"id": "stepfun/step-3.5-flash:free", "name": "StepFun 3.5 Flash"},
    {"id": "nvidia/nemotron-nano-9b-v2:free", "name": "NVIDIA Nemotron 9B v2"},
    {"id": "nvidia/nemotron-nano-12b-v2-vl:free", "name": "NVIDIA Nemotron 12B v2 VL"},
    {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B Instruct"},
    {"id": "openai/gpt-oss-20b:free", "name": "GPT-OSS 20B"},
    {"id": "qwen/qwen3-coder:free", "name": "Qwen 3 Coder"},
    {"id": "google/gemma-3-27b-it:free", "name": "Gemma 3 27B IT"},
    {"id": "qwen/qwen3-next-80b-a3b-instruct:free", "name": "Qwen 3 Next 80B Instruct"},
    {"id": "liquid/lfm-2.5-1.2b-thinking:free", "name": "Liquid LFM 2.5 1.2B Thinking"},
    {"id": "google/gemma-3n-e4b-it:free", "name": "Gemma 3N 4B IT"},
    {"id": "google/gemma-3-4b-it:free", "name": "Gemma 3 4B IT"},
    {"id": "meta-llama/llama-3.2-3b-instruct:free", "name": "Llama 3.2 3B Instruct"},
    {"id": "google/gemma-3-12b-it:free", "name": "Gemma 3 12B IT"},
]

DEFAULT_MODEL_ID = "arcee-ai/trinity-large-preview:free"
