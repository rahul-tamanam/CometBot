# JSOMAdvisor (CometBot)

JSOMAdvisor is a full-stack advising app for the JSOM MSBA program, with three assistant workflows:

- Degree Planner
- Career Mentor
- Skills Gap Analyzer

## Current Architecture

- Frontend: React + Vite + TypeScript + Tailwind
- Backend: FastAPI + Python
- Data/infra:
  - Neo4j for prerequisite/eligibility graph logic
  - Pinecone for semantic retrieval
  - LLM chat service for natural-language responses

## Current Runtime Behavior

- Deterministic logic is used for:
  - Degree requirement math and remaining-course calculations
  - Only-one-of course group constraints
  - Certificate eligibility and remaining requirement groups
  - UI entity highlighting (dictionary-based course/certificate highlighting)
- Probabilistic logic is used for:
  - LLM narrative phrasing
  - Semantic retrieval ranking from Pinecone

## Key Data Files

- `backend/data/courses.json`: course catalog and metadata
- `backend/data/skills.json` (or `skills_clean.json`): job role skills corpus
- `backend/data/certificates/msba_certs.json`: MSBA certificate definitions
- `backend/data/programs/msba/rules.json`: program-level credit and group rules used by Degree Planner

## Project Structure

```text
JSOMAdvisor/
├── frontend/                      # React UI
├── backend/                       # FastAPI app
│   ├── routers/                   # degree_planner, career_mentor, skills_gap
│   ├── services/                  # neo4j, pinecone, llm, validators
│   └── data/                      # courses, skills, certificates, program rules
├── .env
└── README.md
```

## Setup

### Backend (Port 8000)

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Backend URL: `http://127.0.0.1:8000`

### Frontend (Port 5173)

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Environment Variables

Create `.env` in project root:

```env
NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
NEO4J_USERNAME=<username>
NEO4J_PASSWORD=<password>

PINECONE_API_KEY=<api-key>
PINECONE_INDEX=<index-name>

OPENAI_API_KEY=<api-key>
```

## API Endpoints (Current)

- `GET /api/health` - service health
- `GET /api/courses` - course IDs/titles/types/credits (frontend uses this for dictionary highlighting and lookup)
- `GET /api/certificates` - certificate titles/requirements (frontend uses this for dictionary highlighting)
- `POST /api/degree-planner/chat` - planner chat response + structured progress payload
- `POST /api/degree-planner/plan` - deterministic semester plan endpoint
- `POST /api/career-mentor/chat` - career guidance + matched certificates + eligibility details
- `POST /api/skills-gap/analyze` - skills gap analysis from entered data
- `POST /api/skills-gap/analyze-resume` - skills gap analysis from resume upload

## Semantic Indexing

The Pinecone index build script upserts:

- Courses (namespace: `courses`)
- Job roles/skills (namespace: `skills`)
- Certificates (namespace: `certificates`)

Run:

```powershell
venv\Scripts\python backend/build_pinecone_index.py
```

## Career Mentor (Current Certificate Flow)

1. Retrieve job role + relevant courses semantically from Pinecone.
2. Retrieve certificate recommendations semantically from Pinecone `certificates` namespace.
3. Fallback to legacy rule-based cert matcher if semantic retrieval is unavailable.
4. Merge student profile history (`completed_courses` + `course_history`) and compute:
   - completed courses per certificate
   - remaining requirement groups
   - eligibility now / remaining path
5. Return natural-language fit buckets (no raw numeric score shown to user).

## Common Issues

- Neo4j DNS/auth errors:
  - verify `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- Pinecone retrieval/index issues:
  - verify `PINECONE_API_KEY`, `PINECONE_INDEX`
  - re-run `backend/build_pinecone_index.py`
- Endpoint mismatch after code edits:
  - restart backend and confirm route exists in `http://127.0.0.1:8000/openapi.json`

## License

For educational and development use.
