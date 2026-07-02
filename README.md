# ETRA Research Pipeline — V1

Industry research tool for ETRA, a commercial real estate income fund operating in Guatemala, Costa Rica, Panama, El Salvador, and Dominican Republic.

**Default mode: real Claude API.** Enter an industry, the backend calls Claude using `prompts/agent1.txt`, and the output is saved and displayed. No intermediate step, no copy-paste.

---

## Modes

| Mode | env setting | What happens |
|---|---|---|
| **Claude API** (default) | `USE_CLAUDE_API=true` `MOCK_API=false` | Backend calls Claude API. Costs real tokens. |
| **Mock** (fallback) | `MOCK_API=true` | Backend returns `data/mock/agent1_sample.txt`. No API call, no cost. |
| **Manual** (secondary) | Always available | You generate the prompt, run it in Claude yourself, paste the result back. |

---

## Project Structure

```
research project/
├── backend/
│   ├── server.js                 Express + CORS, port 3001
│   ├── routes/
│   │   ├── research.js           POST /api/research (main route)
│   │   ├── prompts.js            POST /api/prompts/agent1
│   │   └── manual.js             POST /api/runs/manual
│   └── services/
│       └── agent1.js             Claude API call + mock fallback
├── frontend/
│   └── src/
│       ├── App.jsx               Primary research form
│       ├── ManualResearch.jsx    Manual paste-back section
│       └── App.css               Dark theme UI
├── prompts/
│   └── agent1.txt                Agent 1 system prompt (edit freely — read fresh per request)
├── data/
│   ├── mock/
│   │   └── agent1_sample.txt     Mock output template
│   └── runs/                     Saved JSON results (all modes, git-ignored)
├── dashboard/                    Future: base dashboard HTML (not modified in V1)
├── reference/                    Style docs, old artifacts (background only)
├── examples/                     Good/bad sector examples (background only)
├── .env.example                  Copy to .env and fill in key
└── .gitignore
```

---

## Setup

### 1. Create your `.env`

```
copy .env.example .env
```

Edit `.env`:

```
PORT=3001
USE_CLAUDE_API=true
MOCK_API=false
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
MAX_OUTPUT_TOKENS=8000
```

**The API key must stay in `.env` only — never committed, never sent to the frontend.**

### 2. Install backend dependencies

```
cd backend
npm install
```

### 3. Install frontend dependencies

```
cd frontend
npm install
```

---

## Running Locally

**Terminal 1 — Backend**

```
cd backend
node --watch server.js
```

The startup log tells you which mode is active and whether the API key is set:

```
ETRA backend running on http://localhost:3001
Mode: claude-api (USE_CLAUDE_API=true)
API key: set
Model:   claude-sonnet-4-5
```

**Terminal 2 — Frontend**

```
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`

---

## Running in Claude API mode

1. Ensure `.env` has `USE_CLAUDE_API=true`, `MOCK_API=false`, and a valid `ANTHROPIC_API_KEY`.
2. Start backend and frontend.
3. Enter an industry (e.g. `Cosméticos y Belleza`) and click **Run Research**.
4. The backend calls Claude. This takes 30–60 seconds and costs real API tokens.
5. Output is saved to `data/runs/` and displayed with a blue **"Claude API mode"** label and token counts.

**This makes real API calls and costs money. Each run uses Agent 1 with up to 8,000 output tokens.**

---

## Switching to mock mode (no cost)

Set in `.env`:

```
MOCK_API=true
USE_CLAUDE_API=false
```

Restart the backend. The app returns the local sample file from `data/mock/agent1_sample.txt` — no API call is made.

---

## Manual mode (always available)

The **Manual Research** section below the main form lets you:
1. Generate the full Agent 1 prompt for any industry.
2. Copy it and paste it into Claude yourself.
3. Paste the response back into the app to save it as a run.

Saved manual runs appear in `data/runs/` with `"mode": "manual"`.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/research` | Main route — Claude API or mock depending on env |
| `POST` | `/api/prompts/agent1` | Returns assembled Agent 1 prompt for an industry |
| `POST` | `/api/runs/manual` | Saves a manually-entered Claude output as a run |

---

## Customizing the prompt

Edit `prompts/agent1.txt`. The file is read fresh on every request — no restart needed.

---

## V1 Scope — What Is NOT Built

| Feature | Status |
|---|---|
| Agent 2 QA / evidence validation | Not built |
| Agent 3 scoring | Not built |
| Dashboard editing | Not built |
| Run history UI | Not built |
| Web search | Not built (TODO in agent1.js) |
| Authentication | Not built |
| Human approval flow | Not built |
| Job queue for long runs | Not built |
