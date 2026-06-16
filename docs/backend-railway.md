# Backend & Railway — deployment, DB, and debugging reference

On-demand reference for the FastAPI backend and its Railway deployment. Pulled in
when debugging persistence / the projects DB — not loaded into context by
default. A one-line pointer lives in `CLAUDE.md`.

## Backend repo

The Python/FastAPI backend is **not** in this repo. It is a sibling directory:

```
../backendForNextApp        # FastAPI backend (routers, DB models, alembic, FDS gen)
```

(Full path: `C:\Users\IanShaw\Documents\localProgramming\fd\backendForNextApp`.)

The frontend talks to it over HTTP. The base URL is resolved in
`Components/ApiCalls.jsx`:

```js
const API_BASE = process.env.NEXT_PUBLIC_API_URL || server_urls.localhost
```

so the deployed frontend must have `NEXT_PUBLIC_API_URL` set, otherwise it falls
back to `http://127.0.0.1:8001`.

## Two distinct backend subsystems (important for debugging)

- **Stateless compute** — `POST /fds`, `/timeEq`, `/radiation`, `/efs/*`.
  Compute a result and return a file. These do **not** touch the database, so
  they keep working even when persistence is broken (e.g. FDS export succeeds
  while saves fail).
- **Projects persistence** — `POST /projects`, `/projects/{id}/save`,
  `/projects/{id}/floors/...`. Backed by Postgres (`projects`, `floors`,
  `elements` tables). Schema is managed by **alembic** migrations in
  `../backendForNextApp/alembic/versions/`.

Note: the Railway start command runs `uvicorn` only — it does **not** run
`alembic upgrade`. Startup self-heal in `backendForNextApp/main.py` only
`create_all`s the `fee_text_block` tables, **not** `projects`/`floors`/
`elements`. Those were migrated by hand on both DBs and exist today, so this is a
latent gotcha for *new* tables/environments, not a live bug. Frontend save
failures are swallowed (`console.error` + `return` in `pages/index.jsx`), and
`shouldAutoSave()` requires `projectId` — so any failed `createProject` silently
disables autosave with no user-visible error.

## Railway deployment (how to inspect)

Railway project **"Web App Misc Tools Backend"** (workspace: *Fire Dynamics's
Projects*, project ID `d8f59631-f674-4cb2-b323-208a3b2a0c13`). The
`backendForNextApp` repo is linked to it (`railway status` from that dir).

**Two environments, each with its own Postgres + S3 (MinIO) — they do NOT share
data:**

| Environment | Backend URL | Used by |
| --- | --- | --- |
| `production` | `https://backendfornextapp-production.up.railway.app` | prod frontend |
| `dev`        | `https://backendfornextapp-dev.up.railway.app`        | fdsgen **dev** branch frontend |

So work done on the dev-branch frontend lands in the **dev** Postgres, not
production. (June 2026 "users' work didn't save" scare: the work was all safely
in the **dev** DB — people were checking the wrong environment. Verified via the
elements endpoint below.)

Useful CLI / API recipes (run from `../backendForNextApp`):

```bash
railway status                                   # show linked project/services
railway environment list                         # production + dev
railway variables --service backendForNextApp --environment dev --kv \
  | grep -E "RAILWAY_PUBLIC_DOMAIN|DATABASE_URL" # dev backend URL + Postgres DSN
railway logs --service backendForNextApp --environment dev
```

## Reading elements gotcha

⚠️ `GET /projects` and `GET /projects/{id}` return `FloorSummary`, which has **no
`elements` field** — floors there always look empty. To see real element counts
you must hit the floor endpoint:

```
GET /projects/{project_id}/floors/{floor_id}            # FloorDetail (incl. elements)
GET /projects/{project_id}/floors/{floor_id}/elements   # bare element list
```

The save path (`POST /projects/{id}/save`) is a delete-then-recreate of all
floors+elements — so an autosave carrying an empty `elements` array will *wipe*
previously-saved geometry for that floor.
