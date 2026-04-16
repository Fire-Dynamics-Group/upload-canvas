# Claude.ai Web App Workflow — Cross-Repo + DB Issues

How to investigate a bug like the lobby-sensor one from the Claude.ai web app when
the work spans the `upload-canvas` (frontend) and `fd-upload-canvas-backend`
(backend) repos AND requires reading real project data from the Railway Postgres.

## The problem

Bugs in the FDS pipeline often require, in one conversation:

1. Reading frontend code (React/Next.js canvas, sensor placement algorithms)
2. Reading backend code (FastAPI, FDS string generation)
3. Reading real project element data from the Railway Postgres DB
4. Running/inspecting an actual `.fds` output to compare against the EXE reference

Claude Code on the desktop handles all four because it has filesystem + shell.
Claude.ai web app doesn't — it needs the context pushed to it or a tool
(connector / MCP server) that pulls it on demand.

## Three workflow shapes

### Option 1 — GitHub connector + read-only debug HTTP endpoint (recommended to start)

**Setup effort:** ~1 hour. **Power:** enough for 80% of investigations.

1. **Enable the GitHub connector** in Claude.ai settings. Grant access to both
   `upload-canvas` and `fd-upload-canvas-backend`. Claude can now read files,
   commits, PRs, issues across both repos and post comments/PRs.
2. **Expose a read-only `/debug/*` API on the backend.** Protect with a shared
   secret header.
   - `GET /debug/projects/{project_id}` → full project row + owner
   - `GET /debug/projects/{project_id}/floors` → floors list
   - `GET /debug/floors/{floor_id}/elements` → the stored `elements` JSON that
     the frontend sends (this is the goldmine — real polygons, doors, zones)
   - `GET /debug/floors/{floor_id}/fds` → last generated `.fds` text
3. **Give Claude the curl pattern** (pinned CLAUDE.md entry or project
   instructions). In a conversation, Claude.ai can `WebFetch` those endpoints
   and reason over the JSON/FDS directly.

Trade-offs:
- Claude can read but not execute code. Fine for diagnosis, slow for fix-iterate
  loops.
- The debug endpoints are auth-gated by a long random header token, not user
  auth — do not deploy without that.

### Option 2 — Custom remote MCP server (recommended once Option 1 hits limits)

**Setup effort:** 1–2 days. **Power:** full.

Build a small MCP server (Python or TS), deploy to Railway or Fly, register its
URL as a connector in Claude.ai. The server exposes tools like:

- `read_frontend_file(path)` / `read_backend_file(path)` — git-clone both repos
  on boot, serve files by path
- `query_project(project_id)` — direct Postgres read against Railway DB
- `run_fds_gen(floor_id)` — invoke the real backend FDS generator on stored
  elements, return the output string (no write — just read-through simulation)
- `run_python(snippet)` — sandboxed eval for ground-truth EXE algorithm
  comparison (ported `centerline.py` etc.)

Key references:
- Model Context Protocol spec: https://modelcontextprotocol.io
- Anthropic's remote MCP docs for Claude.ai Connectors

Trade-offs:
- Real infra to maintain. Worth it if you're doing ≥ weekly cross-repo
  investigations.
- You still can't apply a code fix from Claude.ai directly — it would post a PR
  via the GitHub connector.

### Option 3 — Claude Code on a cloud VM (closest to current local flow)

**Setup effort:** ~2 hours. **Power:** full including code execution.

- Small VM (Hetzner, DO, whatever) with both repos cloned, Railway DB creds in
  env, Python + Node installed.
- Run Claude Code via `claude` CLI over SSH, or use the web UI at
  claude.ai/code which lets you run Claude Code sessions in the browser against
  a connected VM.
- Identical capability to your current laptop setup; just accessible from any
  browser.

Trade-offs:
- Secrets live on the VM. Lock down SSH + rotate DB creds regularly.
- Fastest to set up but doesn't integrate into Claude.ai conversations — it's
  its own channel.

## Recommendation for this codebase

Start with **Option 1**. The read-only `/debug/floors/{id}/elements` endpoint
alone unblocks 90% of "why does the EXE handle this but our app doesn't"
questions — Claude.ai fetches the real polygon, the conversation has both
frontend + backend code via the GitHub connector, and a fix lands as a PR.

Upgrade to Option 2 once you're tired of copy-pasting curl output into
conversations, or once you want Claude.ai to run ported Python EXE code to
produce ground-truth sensor lists for side-by-side comparison.

## Sketch: the `/debug/floors/{id}/elements` endpoint

```python
# fd-upload-canvas-backend, new router
from fastapi import APIRouter, Header, HTTPException
import os

router = APIRouter(prefix="/debug", tags=["debug"])
DEBUG_TOKEN = os.environ["DEBUG_READ_TOKEN"]  # long random, Railway env var

def require_token(x_debug_token: str = Header(...)):
    if x_debug_token != DEBUG_TOKEN:
        raise HTTPException(403, "bad token")

@router.get("/floors/{floor_id}/elements", dependencies=[Depends(require_token)])
async def debug_elements(floor_id: str):
    # read the elements JSON from DB, return as-is
    ...
```

Claude.ai side (once GitHub connector is set up, it will discover the route):

```
WebFetch https://api.upload-canvas.railway.app/debug/floors/<id>/elements
  with header X-Debug-Token: <token>
```

Paste the token into Claude.ai's system prompt / project instructions.

## Notes

- **Never put the Railway DB password into Claude.ai directly.** Always go
  through a backend endpoint or an MCP server that holds the secret server-side.
- **The frontend/backend coordinate boundary still applies.** When Claude.ai
  reasons about sensor positions, remember the frontend is pixel space (Y=0
  top) and the backend applies the flip; compare same-frame coordinates.
- **For ground-truth comparisons against the EXE**, the Python source at
  `C:\Users\IanShaw\Fire Dynamics Group Dropbox (1)\05 R&D\11 IS\Common
  Corridor FDS Gen\populate_fds_file` is the canonical reference. Option 2's
  `run_python` tool is the clean way to expose this to Claude.ai.
