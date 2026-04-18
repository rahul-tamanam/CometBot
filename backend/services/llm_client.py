import os
from openai import OpenAI
from backend.services.validator import (
    validate_and_fix_response,
    soften_length_truncation,
    validate_and_fix_titles,
)

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="not-needed-using-local-lmstudio"
)

MODEL = os.getenv("LLM_MODEL", "local-model")
DEFAULT_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1024"))
FORCE_SYSTEM_IN_USER = os.getenv("LLM_FORCE_SYSTEM_IN_USER", "0") == "1"


def _normalize_messages(messages: list[dict]) -> list[dict]:
    """
    Ensure messages are OpenAI-compatible and only include supported roles.
    Also enforces alternating user/assistant roles (LM Studio templates often require this).
    """
    cleaned: list[dict] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role not in {"system", "user", "assistant"}:
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        cleaned.append({"role": role, "content": content.strip()})

    # Merge consecutive same-role messages to guarantee alternation.
    merged: list[dict] = []
    for m in cleaned:
        if not merged:
            merged.append(m)
            continue
        if merged[-1]["role"] == m["role"]:
            merged[-1]["content"] = merged[-1]["content"].rstrip() + "\n\n" + m["content"].lstrip()
        else:
            merged.append(m)

    # If conversation starts with assistant, insert a user turn.
    # This prevents LM Studio template errors like:
    # "After the optional system message, conversation roles must alternate user and assistant..."
    if merged and merged[0]["role"] == "assistant":
        merged.insert(0, {"role": "user", "content": "Start."})

    return merged

def chat(
    system_prompt: str,
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    validate: bool = True
) -> dict:
    """
    Calls LM Studio (OpenAI-compatible) chat completions.

    By default we send a proper `system` message (works well with Phi).
    If you are using a backend/model that does NOT support `system`,
    set `LLM_FORCE_SYSTEM_IN_USER=1` to fall back to system injection.
    """

    normalized = _normalize_messages(messages)

    if FORCE_SYSTEM_IN_USER:
        # Prepend system prompt into the first user message (legacy fallback)
        formatted: list[dict] = []
        system_injected = False
        for msg in normalized:
            if msg["role"] == "user" and not system_injected:
                formatted.append({
                    "role": "user",
                    "content": f"{system_prompt}\n\n{msg['content']}",
                })
                system_injected = True
            else:
                formatted.append(msg)
        if not system_injected:
            formatted.insert(0, {"role": "user", "content": system_prompt})
    else:
        # Standard OpenAI roles: include system separately
        formatted = [{"role": "system", "content": system_prompt}] + normalized

    response = client.chat.completions.create(
        model=MODEL,
        messages=formatted,
        temperature=temperature,
        max_tokens=max_tokens
    )

    choice = response.choices[0]
    raw_text = choice.message.content or ""
    finish = getattr(choice, "finish_reason", None) or ""
    if finish == "length":
        raw_text = soften_length_truncation(raw_text)

    if validate:
        result = validate_and_fix_response(raw_text)
        title_fix = validate_and_fix_titles(result["text"])
        result["text"] = title_fix["text"]
        # Keep a separate key; callers can ignore safely.
        result["title_corrections"] = title_fix.get("title_corrections", [])
        return result

    return {
        "text":        raw_text,
        "corrections": [],
        "removed":     []
    }