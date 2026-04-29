import json
import os
import sys

sys.path.append(os.path.dirname(__file__))

from services.pinecone_client import upsert_courses, upsert_skills
from services.course_loader import load_all_courses

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def main():
    print("Loading all courses (deduplicated across programs)...\n")
    all_courses = load_all_courses()
    indexable_courses = [
        c for c in all_courses
        if (c.get("course_type") or "").strip().lower() not in ("noncredit", "external")
    ]
    print(f"Found {len(all_courses)} total courses, indexing {len(indexable_courses)} (excluding non-credit)...\n")
    print("Uploading courses to Pinecone...\n")
    upsert_courses(indexable_courses)

    for name in ["skills_clean.json", "skills.json"]:
        path = os.path.join(DATA_DIR, name)
        if os.path.exists(path):
            with open(path) as f:
                skills = json.load(f)
            break

    print(f"\nFound {len(skills)} job roles\n")
    upsert_skills(skills)
    print("\n[done] Pinecone index ready")

if __name__ == "__main__":
    main()