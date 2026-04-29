import os
import sys

sys.path.append(os.path.dirname(__file__))

from services.neo4j_client import load_graph, close
from services.course_loader import load_all_courses

def main():
    print("Loading all courses...\n")
    courses = load_all_courses()
    graph_courses = [
        c for c in courses
        if (c.get("course_type") or "").strip().lower() not in ("noncredit", "external")
    ]

    print(f"Found {len(courses)} total courses, loading {len(graph_courses)} into graph\n")
    print("Building Neo4j graph...\n")

    load_graph(graph_courses)

    print("\n[done] Neo4j graph ready")

if __name__ == "__main__":
    main()
    close()