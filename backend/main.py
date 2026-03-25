import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="MSBA Smart Advisor API",
    description="AI-powered academic and career advisor for MSBA students",
    version="1.0.0"
)

# Allow React frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_methods=["*"],
    allow_headers=["*"]
)

# ── Routers ───────────────────────────────────────────────────────────────────
# We'll add these as we build each component
# from routers import degree_planner, career_mentor, skills_gap
# app.include_router(degree_planner.router, prefix="/api/degree-planner")
# app.include_router(career_mentor.router,  prefix="/api/career-mentor")
# app.include_router(skills_gap.router,     prefix="/api/skills-gap")

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {
        "status":  "ok",
        "message": "MSBA Smart Advisor API is running"
    }


@app.get("/api/courses")
def get_all_courses():
    """
    Returns all valid course IDs and titles.
    Used by the frontend for validation and autocomplete.
    """
    import json
    data_path = os.path.join(os.path.dirname(__file__), "data", "courses.json")
    with open(data_path) as f:
        courses = json.load(f)
    return [
        {
            "course_id":   c["course_id"],
            "title":       c["title"],
            "course_type": c["course_type"],
            "credits":     c.get("credits", 3)
        }
        for c in courses
    ]
from backend.routers import degree_planner, career_mentor, skills_gap

app.include_router(
    degree_planner.router,
    prefix="/api/degree-planner",
    tags=["Degree Planner"]
)
app.include_router(
    career_mentor.router,
    prefix="/api/career-mentor",
    tags=["Career Mentor"]
)
app.include_router(
    skills_gap.router,
    prefix="/api/skills-gap",
    tags=["Skills Gap"]
)