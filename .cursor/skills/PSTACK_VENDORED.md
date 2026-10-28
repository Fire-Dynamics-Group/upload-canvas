# Vendored pstack (pinned)

This directory is a **pinned copy** of Cursor's [pstack](https://github.com/cursor/plugins/tree/main/pstack) plugin skills, vendored so Cursor cloud agents and Project working in this repo follow pstack even when user-installed plugins do not load (Cursor forum, Aug–Sep 2026).

Do not treat these files as live-tracking upstream. **Copies are pinned and must be refreshed manually.**

## Pin

| Field | Value |
|---|---|
| Source | https://github.com/cursor/plugins/tree/main/pstack |
| Upstream commit | `c742dd61706fbacc1b95f1a20b7b988cf096ce6c` |
| Version | `0.15.36` (0.15.x) |
| Author | Lauren Tan |
| License | MIT (see `LICENSE` in this directory and in `.cursor/agents/`) |
| Vendored at | 2026-10-28 |

Subagent definitions from pstack's `agents/` are copied to `.cursor/agents/` (`poteto-agent`, `comment-sicko`). Cursor loads project subagents from `.cursor/agents/`.

Hooks and pstack automations (Benny) are **not** vendored: they do not run in cloud agents.

pstack's own unit tests (`*.test.ts`, bun:test) are **not** copied. This repo's `vitest run` collects `**/*.test.ts`; those files would fail here (they are not part of the app suite). Skills, playbooks, and non-test scripts stay complete.

Project overrides (not from upstream):

- `.cursor/settings.json` — `plugins.pstack.enabled`
- `.cursor/rules/pstack-models.mdc` — all pstack model roles pinned to `grok-4.6` until 8 Nov 2026
- `.cursor/rules/fd-overrides.mdc` — owner shipping / verification overrides
- `.cursor/scripts/check-pstack.sh` — layout + pin check
- `AGENTS.md` — short owner-overrides section

## How to refresh later

1. Fetch a newer pstack commit from https://github.com/cursor/plugins (path `pstack/`).
2. Record the new commit SHA and `version` from `pstack/plugin.json` / `pstack/.cursor-plugin/plugin.json` in this file. Confirm it is still 0.15.x or update the version note.
3. Replace `.cursor/skills/` with `pstack/skills/`, then restore this file (`PSTACK_VENDORED.md`) and keep `LICENSE`.
4. Replace `.cursor/agents/*.md` with `pstack/agents/*.md`, keep `LICENSE`.
5. Do **not** overwrite `.cursor/rules/`, `.cursor/settings.json`, `.cursor/scripts/`, or the owner section in `AGENTS.md`.
6. Skip `hooks/` and `automations/` as before. Skip pstack `*.test.ts` (bun:test) so this repo's vitest does not collect them.
7. Run `.cursor/scripts/check-pstack.sh` and the repo test/build command.
