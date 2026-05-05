# JSOMAdvisor (CometBot)

JSOMAdvisor is a full-stack advising app for JSOM graduate programs (MSBA, MSITM), with three assistant workflows:

- **Degree Planner** (Comet) — catalog-based progress, remaining courses, LLM narrative
- **Career Mentor** — role fit, certificate paths
- **Skills Gap Analyzer** — JD / resume–driven skill gaps

## Architecture

- **Frontend:** React + Vite + TypeScript + Tailwind (multi-page: main site + app shell under `/app/`)
- **Backend:** FastAPI (Python)
- **Data / infra:**
  - **Neo4j** — prerequisite and eligibility graph
  - **Pinecone** — semantic retrieval (courses, skills, certificates)
  - **Groq** — OpenAI-compatible chat completions for LLM responses

## Runtime behavior

- **Deterministic:** degree math, only-one-of groups, certificate groups, course validation, structured API payloads
- **Probabilistic:** LLM phrasing, Pinecone ranking

## Key data files

| Path | Role |
|------|------|
| `backend/data/courses/msba_courses.json` | MSBA catalog (per program) |
| `backend/data/courses/msitm_courses.json` | MSITM catalog |
| `backend/data/courses/shared_courses.json` | Cross-program courses (e.g. MAS 6102); merged by `course_loader` |
| `backend/data/skills.json` | Job / skills corpus for indexing |
| `backend/data/certificates/msba_certs.json` (etc.) | Certificate definitions |
| `backend/data/programs/<program>/rules.json` | Credits, non-credit reqs, internship rules |

There is no single `backend/data/courses.json`; the loader merges program JSON + shared courses.

## Project structure

```text
JSOMAdvisor/
├── frontend/                 # Vite app (`npm run dev` → http://localhost:5173)
├── backend/                  # FastAPI (`main.py`, routers, services, data)
├── .env                      # local secrets (gitignored) — copy from .env.example
├── .env.example              # template for backend + pointers for frontend
├── frontend/.env.example     # Vite env template (transcript API URL)
└── README.md
```

## Quick setup

### 1. Backend (port 8000)

From the **project root** (the directory that contains `backend/`):

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` from `.env.example` and fill in Neo4j, Pinecone, and `GROQ_API_KEY`.

```powershell
uvicorn backend.main:app --reload --port 8000 --env-file .env
```

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

`backend/main.py` calls `load_dotenv()`; using `--env-file .env` with uvicorn keeps env explicit for demos.

### 2. Frontend (port 5173)

```powershell
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and set `VITE_TRANSCRIPTPARSER_API` to your running API, e.g. `http://127.0.0.1:8000/api/parse-transcript`, if you use transcript upload on onboarding.

```powershell
npm run dev
```

- App with React Router: use **`http://localhost:5173/app/onboarding`** or **`http://localhost:5173/app`** as routed (basename `/app`).
- Production build: `npm run build` → output under `frontend/dist/`.

### 3. Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` | Root `.env` | Graph DB |
| `PINECONE_API_KEY`, `PINECONE_INDEX` | Root `.env` | Vector index |
| `GROQ_API_KEY` | Root `.env` | LLM (required for chat features) |
| `GROQ_MODEL`, `LLM_MAX_TOKENS`, `LLM_FORCE_SYSTEM_IN_USER` | Root `.env` | Optional LLM tuning |
| `CORS_ALLOW_ORIGINS` | Root `.env` | Optional comma-separated origins |
| `VITE_TRANSCRIPTPARSER_API` | `frontend/.env` | POST URL for PDF transcript parsing |
| `VITE_SKIP_PASSWORD_AUTH` | `frontend/.env` | Optional dev flag (see `frontend/src/auth.ts`) |

Details and placeholders: **`.env.example`** and **`frontend/.env.example`**.

## API endpoints (summary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/courses?program_id=msba` | Program course catalog (profile / lookups) |
| GET | `/api/programs` | Program list |
| GET | `/api/certificates?program_id=msba` | Certificate metadata |
| POST | `/api/parse-transcript` | PDF transcript parse (onboarding) |
| POST | `/api/degree-planner/chat` | Planner chat + structured progress |
| POST | `/api/degree-planner/plan` | Deterministic semester plan |
| POST | `/api/career-mentor/chat` | Career guidance |
| POST | `/api/skills-gap/analyze` | Skills gap from form data |
| POST | `/api/skills-gap/analyze-resume` | Skills gap from resume upload |

## Pinecone index (optional one-time / refresh)

The build script upserts courses, skills, and certificates into namespaces (e.g. `courses`, `skills`, `certificates`).

```powershell
.\venv\Scripts\python backend\build_pinecone_index.py
```

## Demo checklist

1. **`.env`** at repo root with Neo4j, Pinecone, and **`GROQ_API_KEY`**.
2. **`frontend/.env`** with **`VITE_TRANSCRIPTPARSER_API`** if demoing transcript upload.
3. Start **backend** on 8000, then **frontend** on 5173.
4. Open the app at **`/app/`** routes (e.g. `/app/onboarding`).
5. If degree chat errors on Neo4j, confirm Aura credentials and that the graph matches expected course nodes.

## Common issues

- **Neo4j / auth:** verify `NEO4J_*` and network access.
- **Pinecone:** verify `PINECONE_*`; re-run `build_pinecone_index.py` if the index is empty.
- **LLM errors:** confirm **`GROQ_API_KEY`** and `pip install -r requirements.txt` (includes `groq`).
- **CORS / private network:** backend enables `allow_private_network` for browser preflight to localhost APIs.
- **404 on `/app/...`:** use the Vite dev server and the `/app/` basename; see `frontend/vite.config.ts` SPA fallback.

## Career Mentor (certificate flow)

1. Retrieve role/courses via Pinecone; certificate recommendations from the `certificates` namespace.
2. Fallback rules if semantic retrieval fails.
3. Merge `completed_courses` + `course_history` for eligibility and remaining groups.

## License

For educational and development use.
