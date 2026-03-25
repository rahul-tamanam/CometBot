import json
import os
import sys

sys.path.append(os.path.dirname(__file__))

from services.pinecone_client import upsert_courses, upsert_skills

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def main():
    print("Loading data files...\n")

    with open(os.path.join(DATA_DIR, "courses.json")) as f:
        courses = json.load(f)

    # Find skills file — handles both naming conventions
    for name in ["skills_clean.json", "skills.json"]:
        path = os.path.join(DATA_DIR, name)
        if os.path.exists(path):
            with open(path) as f:
                skills = json.load(f)
            break

    print(f"Found {len(courses)} courses and {len(skills)} job roles\n")
    print("Uploading to Pinecone (this may take a minute)...\n")

    upsert_courses(courses)
    upsert_skills(skills)

    print("\n✅ Pinecone index ready")

if __name__ == "__main__":
    main()