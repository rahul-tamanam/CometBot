import json

with open("backend/data/courses.json") as f:
    courses = json.load(f)

core = [c for c in courses if c.get("course_type", "").lower() == "core"]
elective = [c for c in courses if c.get("course_type", "").lower() == "elective"]

print(f"Core courses: {len(core)}")
print(f"Elective courses: {len(elective)}")

for c in core:
    print(f"{c['course_id']} | {c['title']} | {c['course_type']}")