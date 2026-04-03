import os
import json
import time
import requests
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

# ── Initialize Pinecone ───────────────────────────────────────────────────────

pc    = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX"))

OLLAMA_URL  = "http://localhost:11434/api/embeddings"
EMBED_MODEL = "mxbai-embed-large"

# ── Sanitize helper ───────────────────────────────────────────────────────────

def sanitize(text: str) -> str:
    """
    Removes or replaces characters that may cause
    Ollama embedding failures.
    """
    return (text
            .replace("&", "and")
            .replace("/", " or ")
            .replace("\n", " ")
            .replace("\r", " ")
            .strip())

# ── Embedding helper ──────────────────────────────────────────────────────────

def get_embedding(text: str) -> list[float]:
    for attempt in range(3):
        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model":  EMBED_MODEL,
                    "prompt": text
                },
                timeout=30
            )
            data = response.json()

            if "embedding" in data and len(data["embedding"]) > 0:
                return data["embedding"]

            print(f"  ⚠ Empty embedding on attempt {attempt + 1}, retrying...")
            time.sleep(2)

        except Exception as e:
            print(f"  ⚠ Error on attempt {attempt + 1}: {e}, retrying...")
            time.sleep(2)

    raise ValueError(f"Failed to get embedding for: {text[:50]}")

# ── Upsert helpers ────────────────────────────────────────────────────────────

def upsert_courses(courses: list[dict]):
    """
    Embeds and upserts all courses into Pinecone.
    Uses a rich text document for embedding so semantic
    search captures descriptions, skills, and course type.
    """
    vectors  = []
    skipped  = []

    for course in courses:
        # Truncate description to stay within Ollama limits
        description = (course.get('description') or '')[:500]

        doc = f"""
Course: {course['course_id']} - {course['title']}
Type: {course['course_type']}
Description: {description}
Skills Taught: {', '.join(course.get('skills_taught') or [])}
        """.strip()

        print(f"  ✓ Embedding {course['course_id']}")

        try:
            embedding = get_embedding(sanitize(doc))
        except ValueError as e:
            print(f"  ✗ Skipping {course['course_id']} — {e}")
            skipped.append(course['course_id'])
            continue

        time.sleep(0.2)

        vectors.append({
            "id":     course["course_id"],
            "values": embedding,
            "metadata": {
                "course_id":         course["course_id"],
                "title":             course["title"],
                "credits":           float(course.get("credits", 3)),
                "course_type":       course["course_type"],
                "description":       course.get("description") or "",
                "prerequisites":     json.dumps(
                                         course.get("prerequisites") or []
                                     ),
                "only_one_of_these": json.dumps(
                                         course.get("only_one_of_these") or []
                                     ),
                "skills_taught":     json.dumps(
                                         course.get("skills_taught") or []
                                     )
            }
        })

    # Upsert in batches of 50
    batch_size = 50
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch, namespace="courses")

    print(f"✅ Upserted {len(vectors)} courses into Pinecone")

    if skipped:
        print(f"⚠ Skipped {len(skipped)} courses: {', '.join(skipped)}")


def upsert_skills(skills: list[dict]):
    """
    Embeds and upserts all job roles into Pinecone.
    """
    vectors = []
    skipped = []

    for i, role in enumerate(skills):
        doc = f"""
Job Title: {role['job_title']}
Technical Skills: {', '.join(role['technical_skills'])}
Soft Skills: {', '.join(role['soft_skills'])}
        """.strip()

        print(f"  ✓ Embedding {role['job_title']}")

        try:
            embedding = get_embedding(sanitize(doc))
        except ValueError as e:
            print(f"  ✗ Skipping {role['job_title']} — {e}")
            skipped.append(role['job_title'])
            continue

        time.sleep(0.2)

        vectors.append({
            "id":     f"job_{i}",
            "values": embedding,
            "metadata": {
                "job_title":        role["job_title"],
                "technical_skills": json.dumps(role["technical_skills"]),
                "soft_skills":      json.dumps(role["soft_skills"])
            }
        })

    index.upsert(vectors=vectors, namespace="skills")
    print(f"✅ Upserted {len(vectors)} job roles into Pinecone")

    if skipped:
        print(f"⚠ Skipped {len(skipped)} roles: {', '.join(skipped)}")

# ── Query helpers ─────────────────────────────────────────────────────────────

def query_courses(query: str, top_k: int = 8) -> list[dict]:
    """
    Retrieves the most semantically relevant courses for a query.
    Returns full course dicts with all metadata.
    """
    embedding = get_embedding(sanitize(query))
    return query_courses_by_embedding(embedding, top_k=top_k)


def query_courses_by_embedding(embedding: list[float], top_k: int = 8) -> list[dict]:
    """
    Same as query_courses(), but reuses a precomputed query embedding.
    Useful when you need multiple Pinecone queries for the same user query.
    """
    results = index.query(
        vector=embedding,
        top_k=top_k,
        namespace="courses",
        include_metadata=True
    )

    courses = []
    for match in results["matches"]:
        m = match["metadata"]
        courses.append({
            "course_id":         m["course_id"],
            "title":             m["title"],
            "credits":           float(m["credits"]),
            "course_type":       m["course_type"],
            "description":       m.get("description", ""),
            "prerequisites":     json.loads(m.get("prerequisites", "[]")),
            "only_one_of_these": json.loads(m.get("only_one_of_these", "[]")),
            "skills_taught":     json.loads(m.get("skills_taught", "[]")),
            "score":             round(match["score"], 3)
        })

    return courses


def query_job_role(job_title: str) -> dict | None:
    """
    Finds the closest matching job role for a given title.
    """
    embedding = get_embedding(sanitize(job_title))
    return query_job_role_by_embedding(embedding)


def query_job_role_by_embedding(embedding: list[float]) -> dict | None:
    """
    Same as query_job_role(), but reuses a precomputed query embedding.
    """
    results = index.query(
        vector=embedding,
        top_k=1,
        namespace="skills",
        include_metadata=True
    )

    if not results["matches"]:
        return None

    m = results["matches"][0]["metadata"]
    return {
        "job_title":        m["job_title"],
        "technical_skills": json.loads(m["technical_skills"]),
        "soft_skills":      json.loads(m["soft_skills"]),
        "score":            round(results["matches"][0]["score"], 3)
    }


def query_courses_for_skills(
    skills:      list[str],
    n_per_skill: int = 2
) -> dict[str, list[dict]]:
    """
    For each missing skill, finds the most relevant courses.
    Returns a dict of skill -> list of course dicts.
    """
    recommendations = {}

    for skill in skills:
        results = query_courses(sanitize(skill), top_k=n_per_skill)
        recommendations[skill] = [
            {"course_id": c["course_id"], "title": c["title"]}
            for c in results
        ]

    return recommendations