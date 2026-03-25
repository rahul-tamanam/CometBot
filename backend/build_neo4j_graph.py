import json
import os
import sys

sys.path.append(os.path.dirname(__file__))

from services.neo4j_client import load_graph, close

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def main():
    print("Loading courses.json...\n")

    with open(os.path.join(DATA_DIR, "courses.json")) as f:
        courses = json.load(f)

    print(f"Found {len(courses)} courses\n")
    print("Building Neo4j graph...\n")

    load_graph(courses)

    print("\n✅ Neo4j graph ready")

if __name__ == "__main__":
    main()
    close()