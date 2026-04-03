"""
Quick-and-dirty RAG profiler.

Runs the same building blocks used by the API and prints per-stage timings.
This helps answer questions like:
- Is query embedding (Ollama) the bottleneck?
- Is Pinecone query slow?
- Is the LLM call slow because the prompt/context is huge?

Usage (PowerShell):
  venv\\Scripts\\activate
  python backend\\profile_rag.py --mode career --query "data scientist"

Notes:
- Requires your `.env` to be set (Pinecone, etc.).
- Requires Ollama embeddings endpoint running at http://localhost:11434.
- Requires LM Studio/OpenAI-compatible endpoint at http://localhost:1234 (as configured in llm_client.py).
"""

from __future__ import annotations

import argparse
import time

from backend.services.pinecone_client import query_courses, query_job_role, get_embedding, sanitize
from backend.services.llm_client import chat


def _t(label: str, fn):
    t0 = time.perf_counter()
    out = fn()
    dt = time.perf_counter() - t0
    return out, dt, label


def profile_career(query: str, top_k: int) -> int:
    timings: list[tuple[str, float]] = []

    # 1) Embedding (same model + endpoint as production RAG path)
    _, dt, _ = _t("embed(query)", lambda: get_embedding(sanitize(query)))
    timings.append(("embed(query)", dt))

    # 2) Pinecone queries (these each embed again in the current code)
    job_role, dt, _ = _t("pinecone: job_role (includes embed)", lambda: query_job_role(query))
    timings.append(("pinecone: job_role (includes embed)", dt))

    courses, dt, _ = _t(f"pinecone: courses top_k={top_k} (includes embed)", lambda: query_courses(query, top_k=top_k))
    timings.append((f"pinecone: courses top_k={top_k} (includes embed)", dt))

    # 3) Prompt size + LLM call
    job_context = ""
    if job_role:
        job_context = (
            "CLOSEST MATCHING JOB ROLE:\n"
            f"Title: {job_role['job_title']}\n"
            f"Match confidence: {job_role['score']}\n"
            f"Technical Skills Required: {', '.join(job_role['technical_skills'])}\n"
            f"Soft Skills Required: {', '.join(job_role['soft_skills'])}\n"
        )

    courses_context = "\n\n".join(
        [
            f"Course ID: {c['course_id']}\n"
            f"Title: {c['title']}\n"
            f"Type: {c['course_type']} | Credits: {c.get('credits', 3)}\n"
            f"Skills Taught: {', '.join(c.get('skills_taught') or []) or 'N/A'}"
            for c in courses
        ]
    )

    system_prompt = (
        "You are a career mentor for MSBA students at UT Dallas.\n"
        "Use the provided job role and relevant courses.\n\n"
        f"{job_context}\n\nRELEVANT COURSES:\n\n{courses_context}"
    ).strip()

    prompt_chars = len(system_prompt) + len(query)
    _, dt, _ = _t("llm: chat()", lambda: chat(system_prompt=system_prompt, messages=[{"role": "user", "content": query}]))
    timings.append(("llm: chat()", dt))

    # Output
    print("\n=== RAG profile (career) ===")
    print(f"query: {query!r}")
    print(f"top_k: {top_k}")
    print(f"courses_returned: {len(courses)}")
    print(f"prompt_chars (system+user): {prompt_chars}")
    print("")
    total = 0.0
    for name, dt in timings:
        total += dt
        print(f"{name:40s} {dt:7.2f}s")
    print(f"{'TOTAL':40s} {total:7.2f}s\n")

    # Important hint: current code re-embeds per pinecone call.
    print("Notes:")
    print("- query_job_role() and query_courses() each call get_embedding(); this duplicates embedding work per request.")
    print("- If embed(query) is slow, check Ollama embed model latency (mxbai-embed-large) and CPU/GPU usage.")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["career"], default="career")
    p.add_argument("--query", required=True)
    p.add_argument("--top-k", type=int, default=8)
    args = p.parse_args()

    if args.mode == "career":
        return profile_career(args.query, args.top_k)
    raise SystemExit("unsupported mode")


if __name__ == "__main__":
    raise SystemExit(main())

