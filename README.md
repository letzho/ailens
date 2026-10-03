# AI Lens - smart-glasses copilot (React + Vite + Express)

Turns a web page into a smart lens. The camera feed, live captions and AI answers are drawn
**inside the lenses of `AISPEC.png`**.

```
ai-lens/
  frontend/   React + Vite UI (lens, camera, mic, modes)
  backend/    Express API  (OpenAI, Tavily, Pinecone RAG, Supabase)  <- reads backend/.env
  api/        Vercel entry that re-exports the backend
  vercel.json
```

## Use cases
| Mode | What it does |
|------|--------------|
| **Open House** | Student ambassador mode. A visitor asks a question (mic or typed) -> the lens shows a ready-to-say answer taken from the NYP School of Engineering website (RAG over Pinecone, Tavily live search as fallback, bundled snapshot as last resort). |
| **Lab Vision** | Camera on. Show a resistor/board/equipment: the lens labels the object, reads the colour bands, explains it, warns about safety. Works for lecturers and students. |
| **General** | Any question; sees the camera too if it is on and the question is visual ("what is this?"). |

Controls: **MIC** (live transcription), **CAMERA** on/off, **SCAN** (identify now), **AUTO** (rescan every 8 s),
**VOICE** (read the answer aloud), **Visitor speaks / I speak** (who the AI is answering), **Live captions / Whisper AI** (speech engine).

## 1. Setup (local)
```bash
cd ai-lens
npm install                      # installs frontend + backend (npm workspaces)
cp backend/.env.example backend/.env
# edit backend/.env  ->  at minimum OPENAI_API_KEY
npm run dev                      # API :8787  +  web http://localhost:5173
```
Camera and mic need `localhost` or HTTPS (Vercel is HTTPS). Chrome/Edge recommended.

## 2. Optional services
**Tavily + Pinecone (RAG for Open House)**
1. Put `TAVILY_API_KEY` and `PINECONE_API_KEY` in `backend/.env`.
2. `npm run ingest` (add `-- --crawl` to also crawl linked SEG pages). It scrapes the SEG page with Tavily,
   chunks it, embeds with OpenAI, and upserts to Pinecone (index is created automatically, 1536 dims, cosine).
3. Re-run before each Open House to refresh. Or call `POST /api/advisor/ingest` with header `x-admin-key`.

Without Pinecone the advisor still works: Tavily live search, then `backend/data/seg-seed.md` (snapshot of the SEG page).

**Supabase (interaction log + history)**
Run `backend/supabase/schema.sql` in the Supabase SQL editor, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
Every Q&A is stored in `lens_interactions`; the lens reloads the session history on start.
The service-role key stays on the server only.

## 3. Deploy to Vercel
1. Push the repo to GitHub, import it in Vercel (root directory = repo root).
2. Add every variable from `backend/.env.example` (including `APP_PIN` and `AUTH_SECRET`) in *Project -> Settings -> Environment Variables*.
   Set `CORS_ORIGINS` to your Vercel URL (or leave empty).
3. Deploy. `vercel.json` builds `frontend/` and serves the API from `api/index.js`.
4. Run `npm run ingest` locally once (it writes to your Pinecone cloud index).

## PIN lock
Only people with your PIN can open the lens or call any AI endpoint.
- Set `APP_PIN` (and a random `AUTH_SECRET`) in `backend/.env`, and the same two variables in Vercel.
- Login sets a signed, HttpOnly cookie that lasts `AUTH_TTL_HOURS` (default 12). The LOCK button logs out.
- 8 wrong PINs per IP per 15 minutes are blocked. Use 6+ digits.
- Locally, leaving `APP_PIN` empty disables the lock. On Vercel a missing `APP_PIN` or `AUTH_SECRET` blocks everything.
- Changing `AUTH_SECRET` logs everyone out.
- `/api/advisor/ingest` is separate and uses `ADMIN_KEY`.

## Models
Defaults: `gpt-4o-mini` (text), `gpt-4o` (camera), `text-embedding-3-small`, `gpt-4o-mini-transcribe`.
Change them in `backend/.env` without touching code.

## Notes
- Answers are limited to ~45 words so they fit the lens. The full text is shown below the glasses and in the session log.
- Only a small JPEG of the current camera frame is sent, and only when you ask or press SCAN.
- Get consent before pointing the camera at people. Do not scan IDs or personal data.
- Accuracy: always confirm resistor values with a multimeter; confirm JAE points/intakes on nyp.edu.sg.
