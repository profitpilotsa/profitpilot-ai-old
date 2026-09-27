# Phase 1 Task 2 — deployment bundle candidate

Date: 2026-09-27. Base: `9d44b9f`, branch `engine-integration`, initially clean.
Status: **BLOCKED — implementation prepared; runtime verification incomplete.**

## Change

`app.mjs` retains the native Express detector import and default application
export, but imports `dist/vercel/api.mjs`. The Vercel build produces that file
with the existing esbuild dependency, bundling internal API imports while
leaving installed packages external. Output targets Node 22 and stays outside
`dist/public`. No environment substitution or secret embedding is configured.
The standalone build, server routes, middleware ordering, and domain code are
unchanged. No dependency or lockfile changes are needed.

Official references checked:
- https://vercel.com/docs/frameworks/backend/express — supports root `app.mjs`
  with an Express import and default application export.
- https://vercel.com/kb/guide/ship-a-express-app-on-vercel — describes tracing
  rather than application-code bundling.
- https://github.com/vercel/vercel/blob/main/packages/backends/src/index.ts —
  runs the configured build before entrypoint resolution/tracing. Provider
  source can evolve; deployed runtime verification remains required.

## Evidence

- PASS: direct Node TypeScript check (`tsc --noEmit --incremental false`).
- PASS: Node syntax checks for the entry and bundle smoke test.
- PASS: `git diff --check`; no changes under server/client/shared.
- PASS (limited): changed-file patterns for private keys, common token prefixes,
  and non-local credential-bearing PostgreSQL URLs found no matches.
- BLOCKED: installed pnpm executable exits `-1073741515` (`0xC0000135`).
- BLOCKED: direct Node Phase 1 Vitest, Vite build, and esbuild API bundle hit
  ancestor-directory `Access is denied`. No ACL investigation repeated.
- BLOCKED: native ESM smoke test cannot import the bundle because that build
  did not produce it; this is not evidence of an application runtime defect.
- BLOCKED: Vercel CLI read-only project inspection returned `fetch failed`.
  Local project metadata names `profitpilot-phase1-api`, Node 22. No deployment
  or project configuration mutation was performed. Protected `profitpilot-ai`
  was untouched.

## Required continuation

Run `pnpm run check`, `pnpm run test:phase1`, `pnpm run build:vercel`, and
`pnpm run test:vercel` in a working runtime. The new smoke test imports the
actual deployment entry through native Node ESM and checks health 200, missing
and invalid webhook signature 401 (including malformed JSON to exercise
verification-before-parsing), and missing worker secret 401, with synthetic
configuration only. CI now includes build and bundle smoke gates.

Inspect generated API imports: internal relative server imports must be absent;
external packages must resolve. Check generated artifacts for secret leakage.
Confirm the remote target is the isolated API project, then verify its deployed
source identity, health 200, webhook fail-closed responses and worker-secret
rejection. Do not claim Task 2 PASS from build success alone.

No commit was created because the user's commit authorization was conditional
on verification. No push was performed. Do not begin Task 3.

## Learning candidate (not promoted)

An extension fix in the entrypoint does not resolve deeper native ESM imports.
Reuse the existing esbuild strategy at the deployment boundary and verify the
actual generated entry with native Node, not only a TypeScript-aware test runner.
Runtime confirmation is still pending; no permanent vault learning was added.
