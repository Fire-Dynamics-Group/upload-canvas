# upload-canvas — project notes

Next.js frontend for the FDS-generation / fire-engineering canvas tool. PDF
upload, scale calibration, element drawing, FDS export, plus radiation, time
equivalence and EFS modes.

## Backend (separate repo + Railway)

The Python/FastAPI backend is a **sibling repo**, not in this tree:
`../backendForNextApp`. It's deployed on Railway with **two environments**
(`production` and `dev`), each with its **own Postgres** — the dev-branch
frontend writes to the dev DB, not production.

For backend/Railway/DB debugging detail (env URLs, CLI recipes, the
read-elements endpoint gotcha, save delete-then-recreate behaviour), see
**`docs/backend-railway.md`**.

## Related sibling repos

- `../backend-time-eq-monte-carlo` — time-equivalence Monte Carlo backend
- `../cfd-post-processing`, `../i-macs`, `../fd-toolstation` — other FD tools

## Scale tool

See `docs/scale-tool-ux.md` for the calibration UX (shipped + deferred).
