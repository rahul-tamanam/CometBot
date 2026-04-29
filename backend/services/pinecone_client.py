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
Track: {course.get('course_track') or 'N/A'}
Description: {description}
Skills Taught: {', '.join(course.get('skills_taught') or [])}
        """.strip()

        print(f"  [ok] Embedding {course['course_id']}")

        try:
            embedding = get_embedding(sanitize(doc))
        except ValueError as e:
            print(f"  [skip] Skipping {course['course_id']} - {e}")
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
                                     ),
                "programs":          course.get("programs") or [],
                "course_track":      course.get("course_track") or "",
                "course_tracks":     json.dumps(
                                         course.get("course_tracks") or []
                                     ),
            }
        })

    # Upsert in batches of 50
    batch_size = 50
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch, namespace="courses")

    print(f"[done] Upserted {len(vectors)} courses into Pinecone")

    if skipped:
        print(f"[warn] Skipped {len(skipped)} courses: {', '.join(skipped)}")


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

        print(f"  [ok] Embedding {role['job_title']}")

        try:
            embedding = get_embedding(sanitize(doc))
        except ValueError as e:
            print(f"  [skip] Skipping {role['job_title']} - {e}")
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
    print(f"[done] Upserted {len(vectors)} job roles into Pinecone")

    if skipped:
        print(f"[warn] Skipped {len(skipped)} roles: {', '.join(skipped)}")


def upsert_certificates(certificates: list[dict]):
    """
    Embeds and upserts certificate records into Pinecone.
    Uses richer text so semantic retrieval captures title, overview, required
    courses, and skills taught.
    """
    vectors = []
    skipped = []

    for i, cert in enumerate(certificates):
        cert_title = str(cert.get("cert_title", "")).strip()
        total_credits = cert.get("total_credits", 0)
        overview = str(cert.get("overview", "") or "")[:1200]
        skills_taught = cert.get("skills_taught") or []
        course_groups = cert.get("course_id") or []
        course_group_text = []
        for group in course_groups:
            if isinstance(group, list):
                course_group_text.append(" OR ".join([str(x).strip() for x in group if str(x).strip()]))

        doc = f"""
Certificate: {cert_title}
Total Credits: {total_credits}
Overview: {overview}
Skills Taught: {", ".join([str(s) for s in skills_taught])}
Required Course Groups: {"; ".join(course_group_text)}
        """.strip()

        print(f"  [ok] Embedding certificate {cert_title}")

        try:
            embedding = get_embedding(sanitize(doc))
        except ValueError as e:
            print(f"  [skip] Skipping certificate {cert_title} - {e}")
            skipped.append(cert_title or f"cert_{i}")
            continue

        time.sleep(0.2)
        vectors.append({
            "id": f"cert_{i}",
            "values": embedding,
            "metadata": {
                "cert_title": cert_title,
                "total_credits": float(total_credits or 0),
                "overview": overview,
                "course_id": json.dumps(course_groups),
                "skills_taught": json.dumps(skills_taught),
            },
        })

    if vectors:
        index.upsert(vectors=vectors, namespace="certificates")
    print(f"[done] Upserted {len(vectors)} certificates into Pinecone")

    if skipped:
        print(f"[warn] Skipped {len(skipped)} certificates: {', '.join(skipped)}")


def _fit_label_for_score(score: float) -> str:
    """
    Convert raw vector similarity into student-friendly fit language.
    """
    if score >= 0.74:
        return "Strong fit"
    if score >= 0.64:
        return "Good fit"
    if score >= 0.56:
        return "Relevant fit"
    return "Potential fit"


def query_certificates_by_embedding(embedding: list[float], top_k: int = 4) -> list[dict]:
    """
    Retrieves semantically relevant certificates for a query embedding.
    Returns fit label words (not numeric score) for student-facing UX.
    """
    results = index.query(
        vector=embedding,
        top_k=top_k,
        namespace="certificates",
        include_metadata=True,
    )

    certs = []
    for match in results.get("matches", []):
        m = match.get("metadata", {})
        raw_score = float(match.get("score", 0) or 0)
        certs.append({
            "cert_title": m.get("cert_title", ""),
            "total_credits": float(m.get("total_credits", 0) or 0),
            "overview": m.get("overview", ""),
            "course_id": json.loads(m.get("course_id", "[]")),
            "skills_taught": json.loads(m.get("skills_taught", "[]")),
            "fit_label": _fit_label_for_score(raw_score),
            "fit_reason": (
                "This certificate has high semantic overlap with your target role's skills and responsibilities."
                if raw_score >= 0.64
                else "This certificate is directionally relevant and can strengthen role readiness."
            ),
        })
    return certs

# ── Query helpers ─────────────────────────────────────────────────────────────

def query_courses(query: str, top_k: int = 8, program_id: str = None) -> list[dict]:
    """
    Retrieves the most semantically relevant courses for a query.
    Returns full course dicts with all metadata.
    """
    embedding = get_embedding(sanitize(query))
    return query_courses_by_embedding(embedding, top_k=top_k, program_id=program_id)


def query_courses_by_embedding(embedding: list[float], top_k: int = 8, program_id: str = None) -> list[dict]:
    """
    Same as query_courses(), but reuses a precomputed query embedding.
    Useful when you need multiple Pinecone queries for the same user query.
    """
    filter_dict = None
    if program_id:
        filter_dict = {"programs": {"$in": [program_id.strip().lower()]}}

    results = index.query(
        vector=embedding,
        top_k=top_k,
        namespace="courses",
        filter=filter_dict,
        include_metadata=True
    )

    courses = []
    for match in results["matches"]:
        m = match["metadata"]
        programs_raw = m.get("programs", [])
        if isinstance(programs_raw, str):
            try:
                programs_val = json.loads(programs_raw)
            except Exception:
                programs_val = [programs_raw]
        elif isinstance(programs_raw, list):
            programs_val = programs_raw
        else:
            programs_val = []
        courses.append({
            "course_id":         m["course_id"],
            "title":             m["title"],
            "credits":           float(m["credits"]),
            "course_type":       m["course_type"],
            "description":       m.get("description", ""),
            "prerequisites":     json.loads(m.get("prerequisites", "[]")),
            "only_one_of_these": json.loads(m.get("only_one_of_these", "[]")),
            "skills_taught":     json.loads(m.get("skills_taught", "[]")),
            "programs":          programs_val,
            "course_track":      m.get("course_track", ""),
            "course_tracks":     json.loads(m.get("course_tracks", "[]")),
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
    n_per_skill: int = 2,
    program_id: str = None
) -> dict[str, list[dict]]:
    """
    For each missing skill, finds the most relevant courses.
    Returns a dict of skill -> list of course dicts.
    """
    recommendations = {}

    for skill in skills:
        results = query_courses(sanitize(skill), top_k=n_per_skill, program_id=program_id)
        recommendations[skill] = [
            {"course_id": c["course_id"], "title": c["title"]}
            for c in results
        ]

    return recommendations