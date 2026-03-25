from openai import OpenAI
from backend.services.validator import validate_and_fix_response

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="not-needed-using-local-lmstudio"
)

MODEL = "local-model"

def chat(
    system_prompt: str,
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 1024,
    validate: bool = True
) -> dict:
    """
    Mistral only supports 'user' and 'assistant' roles.
    We inject the system prompt into the first user message.
    """

    # Build Mistral-compatible messages
    # Prepend system prompt to the first user message
    formatted = []
    system_injected = False

    for msg in messages:
        if msg["role"] == "user" and not system_injected:
            formatted.append({
                "role": "user",
                "content": f"{system_prompt}\n\n{msg['content']}"
            })
            system_injected = True
        else:
            formatted.append(msg)

    # If no user message existed yet, create one with just the system prompt
    if not system_injected:
        formatted.insert(0, {
            "role": "user",
            "content": system_prompt
        })

    response = client.chat.completions.create(
        model=MODEL,
        messages=formatted,
        temperature=temperature,
        max_tokens=max_tokens
    )

    raw_text = response.choices[0].message.content

    if validate:
        result = validate_and_fix_response(raw_text)
        return result

    return {
        "text":        raw_text,
        "corrections": [],
        "removed":     []
    }