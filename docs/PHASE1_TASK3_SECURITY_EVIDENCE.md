# Phase 1 Task 3 — authorization hardening evidence

Date: 2026-09-28
Status: **BLOCKED — implementation candidate; required runtime verification unavailable.**
Not READY FOR CHATGPT REVIEW for closure; not FINAL CLOSED.

## Starting safety state

- Repository: `C:\Users\Ayman\Documents\Codex\2026-09-19\plugin-browser-openai-bundled-x20\work\profitpilot-ai-old-clean`
- Branch: `engine-integration`
- HEAD: `b741b5b6d1bf944ef3ff95e2a8fbd6b8885ff342`
- Initial `git status --short`: empty.
- Vault current-state, agent instructions, security, testing and Phase 1 execution notes read. The explicit Task 3 assignment supersedes stale Task 2 execution text. No vault writes.

## Scope and architecture

Only runtime role/mode hardening and a deterministic HTTP authorization test seam.
Existing path remains Supabase `/auth/v1/user` verification -> canonical internal
user -> membership -> organization -> store -> environment -> permission -> scoped
commerce repository. Organization remains the tenant boundary.

Production app construction still defaults to real Supabase and PostgreSQL
adapters. The optional dependency factory is supplied by server code, accepts no
request argument and cannot be chosen through HTTP. Tests retain the actual
Supabase verifier with a synthetic fetch transport, context resolver, permission
check and commerce service. No external Auth or database calls are intended by
these fixtures. No new mutation route, migration, RBAC roles or tenant model.

## Files changed and justification

- `server/phase1.ts`: canonical mode parser and own-property role guard; permission checks reject malformed roles before indexing permissions.
- `server/foundation/context.ts`: validate unknown request mode and persisted membership role; verify returned store ID matches requested store ID.
- `server/foundation/postgresTenantRepository.ts`: parse text-backed role and organization mode instead of asserting their types.
- `server/http/app.ts`: narrow commerce dependency factory; remove route mode assertion; retain real resolver and service.
- `tests/phase1-http-authorization.test.ts`: deterministic HTTP adversarial cases and parser tests.
- `docs/PHASE1_TASK3_SECURITY_EVIDENCE.md`: this evidence record.

## Runtime validation and security review

Source review: mode is explicitly required by the existing header contract.
Only exact `demo` and `live` values are accepted; no default or coercion.
Role validation uses existing ROLE_PERMISSIONS own keys, excluding inherited
properties such as constructor/toString. All seven existing roles remain.
Invalid roles yield FORBIDDEN; invalid/missing request modes yield VALIDATION_ERROR.
These are intended results, pending execution of the new tests.

Authentication implementation remains unchanged and calls the authenticated
Supabase user endpoint. Client query identity/role/mode values are not used to
construct trusted context. Protected repository listProducts remains after context
resolution and CommerceQueryService authorization. Privileged DB capability is
not used as authorization. Webhook/internal worker handlers are unchanged.

## HTTP adversarial matrix

All rows below are **BLOCKED: authored, not executed** because Vitest failed
before test discovery. Expected statuses are test assertions, not observed results.

| Cases | Expected assertion |
| --- | --- |
| Missing, malformed, empty, rejected authentication | 401; no protected operation |
| Missing canonical user / mismatched subject | 403 / 401; no protected operation |
| User A -> Org A -> Store A; all seven valid roles | 200; exact scoped operation once |
| User A -> Org B -> Store B | 403; no protected operation |
| User A -> Org A -> Store B | 403; no protected operation |
| Nonexistent organization/store | 403; no protected operation |
| Forged organization/store/provider IDs and query user/role | Cannot grant access or change trusted scope |
| Valid Live and isolated Demo | Exact corresponding scope reaches repository |
| Invalid, malformed, empty or missing mode | 400; no protected operation |
| Demo + Live organization or Live store | 403; no protected operation |
| Live + Demo store | 403; no protected operation |
| Foreign tenant + matching manipulated Demo mode | 403; no protected operation |
| Unsupported, prototype, malformed or missing persisted role | 403; no protected operation |
| Repository returns a different store ID | 403; no protected operation |
| Unexpected dependency failure | Generic 503 INTERNAL_ERROR; synthetic private detail absent |
| Every denied request | Protected listProducts spy not called; response body exact safe envelope |
| POST to commerce products | 404; no commerce mutation route |
| Runtime parser wrong types, casing, whitespace, arrays, prototype names | Rejected without conversion/default |

Read isolation is applicable here. Mutation authorization is N/A for this GET-only
route; existing governed mutation/job boundaries require applicable regression
and eventual Task 5 end-to-end verification. No mutation endpoint was invented.

## Initial implementation attempt — commands and results

Commands ran from the repository above, without pnpm installation or repair.

| Command | Result |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS, exit 0 |
| `node node_modules/vitest/vitest.mjs run --config vitest.phase1.config.ts` | BLOCKED, exit 1 before discovery: esbuild ancestor-directory Access is denied |
| `node node_modules/vite/bin/vite.js build` | BLOCKED, exit 1 loading Vite config: same access restriction |
| `node node_modules/esbuild/bin/esbuild server/http/app.ts --platform=node --target=node22 --packages=external --bundle --format=esm --outfile=dist/vercel/api.mjs` | BLOCKED, exit 1: same access restriction; source unresolved |
| `node --test tests/vercel-bundle.test.mjs` | PASS, 1 test, against PRE-EXISTING artifact only; NOT current-source Task 2 regression proof |
| `git diff --check` | PASS |
| Targeted source diff review | PASS for scope; runtime conclusions remain unverified |

The pnpm known environment issue was not retried. Direct esbuild access failure
is a separate observed blocker. Repository file writes succeeded. No investigation
of the previous app write issue, ACL changes, installation changes or external
workspace writes was performed.

## Task 1 and Task 2 relevance

Task 1 migration, policies, grants and schema are unchanged. RLS remains defense
in depth. Existing Phase 1 security/migration tests were selected by the standard
suite but did not execute because runner startup failed. No live database checks.

Task 2 API entry/configuration is unchanged. Existing-artifact smoke observed
health and unauthenticated webhook/worker rejection, but current-source Vite/API
build and bundle regression remain BLOCKED. No deployment or Vercel changes.

## Secrets and invariants

Changed source and synthetic fixture content reviewed; no real secret values
introduced. Secret-pattern inspection found no matching added secret material.
No environment values read or changed. No financial logic, UI, provider
configuration, RLS or ingestion changes. Unknown/actual/cash and financial
mutation invariants remain outside the changed logic.

## Git, remaining risks and next step

No commit or push: required local test/build gates have not passed.
Task 3 work remains uncommitted in the verified starting branch.
No Task 3 CI run exists; CI cannot replace the user's pre-push local gate.

Run the listed direct checks in an environment where esbuild can access required
paths. Diagnose any Task 3 test failures, rerun relevant checks, then inspect the
final diff and secret safety before the authorized commit/push. Verify Phase 1
foundation CI for the resulting commit. Ayman/ChatGPT must review actual passing
HTTP/security/build evidence before Task 3 can become FINAL CLOSED.

Task 4 real Salla ingestion/configuration and Task 5 full critical E2E/security
closure remain deferred and were not started. Production hardening/independent
review remain necessary; this candidate is not a production security attestation.

## Learning update proposal

None. The observed esbuild ancestor-access blocker is already documented in the
Task 2 evidence; no duplicate durable learning is proposed.

## Resume verification — 2026-09-28

**BLOCKED; submitted for ChatGPT review of the blocker, not closure.**

Resumed the existing six-file candidate. The intentionally removed temporary
resume prompt was not recreated. Branch remains `engine-integration`; HEAD is
`b741b5b6d1bf944ef3ff95e2a8fbd6b8885ff342`. Only this evidence file was edited
during the resume; implementation and tests were retained unchanged.

### Current-source gate results

The direct commands in the initial-attempt table were rerun with these results:

| Gate | Actual resume result |
| --- | --- |
| TypeScript, `--noEmit --incremental false` | PASS, exit 0 |
| Phase 1 Vitest, `--config vitest.phase1.config.ts` | BLOCKED, exit 1 before discovery: ancestor Access is denied, then config resolution fails |
| Vite build | BLOCKED, exit 1 loading config: same ancestor denial |
| esbuild API bundle | BLOCKED, exit 1: same ancestor denial and source resolution failure |
| `git diff --check` | PASS, exit 0; LF-to-CRLF warnings |
| Current-source native bundle smoke | BLOCKED by failed API build; not rerun against stale output |

The Phase 1 config selects all six suites: HTTP authorization, security,
migration, API runtime, credential vault, and webhook/jobs. No tests executed
in this resume. The adversarial matrix remains unverified, and Task 1/Task 2
runtime regressions remain blocked. No live database/RLS checks were performed.

### Bounded diagnosis

- Node is `v24.19.0`; CI specifies Node 22. No runtime installation attempted.
- Read-only Node directory probes succeeded from the workspace through
  `C:\Users\Ayman\Documents`, but `C:\Users\Ayman` enumeration returned `EPERM`.
  Enumeration of `C:\Users` and `C:\` succeeded. Directory contents were not
  printed.
- esbuild's failing six-level ancestor (`../../../../../..`) resolves to
  `C:\Users\Ayman`. Direct reads of the Vitest config and API source succeeded.
- Vitest uses installed esbuild `0.21.5`; Vite and the API build use `0.25.10`.
  Both versions failed at the same ancestor.
- An in-memory esbuild `0.25.10` TypeScript transform succeeded, producing
  `const probe = 1;`. Binary launch and transformation work; filesystem
  resolution remains blocked.
- The immediate blocker is ancestor-directory access during resolution.
  The underlying Windows ACL versus managed sandbox cause is not established.
  No ACL changes or restriction bypass were attempted.
- Existing `dist/vercel/api.mjs` is 90,999 bytes, last-write UTC
  `2026-09-27 14:24:23`. Its earlier smoke PASS is not current-source evidence.

No pnpm repair, dependency/lockfile change, security weakening, provider action,
deployment, vault write, or implementation change occurred. Diagnostic probes
did not read or print secret environment values.

### Review disposition

Required gates remain blocked: no staging, commit, or push. The conditional
commit `feat: harden phase1 tenant authorization` was not created, and the
one-run push exception was not exercised. There is no resulting Task 3 SHA
whose GitHub foundation CI could be verified; prior CI cannot validate this
uncommitted source.

Next action: rerun the recorded gates on this same candidate in an authorized
execution environment where required ancestor traversal is permitted. Require
current-source Phase 1 tests, Vite build, API build, and native bundle smoke to
pass before commit/push, then verify CI for the exact SHA and return evidence
to ChatGPT. Task 3 is not FINAL CLOSED. Tasks 4 and 5 were not started.

---

# Manual Verification Addendum — 2026-09-28

## Status Update

The earlier BLOCKED results in this document describe the Codex
`workspace-write` sandbox environment at the time of the original run.

They are retained above as historical execution evidence and are not the
current verification status.

The same Task 3 worktree was subsequently verified manually from ordinary
Windows PowerShell outside the Codex sandbox.

## Environment Diagnosis

- `C:\Users\Ayman` directory access from ordinary PowerShell: PASS.
- Repository directory access from ordinary PowerShell: PASS.
- Node runtime available: v24.19.0.
- The previous ancestor-directory `Access is denied` condition was therefore
  isolated to the Codex sandbox execution environment for these checks.
- No Windows ACL/security weakening or permission bypass was performed.

## Task 3 HTTP Authorization / Tenant Security

Command:

`node .\node_modules\vitest\vitest.mjs run --root "." tests/phase1-http-authorization.test.ts`

Final result:

- Test files: 1 passed.
- Tests: 58 passed / 58 total.
- Runtime authorization suite: PASS.

Verified coverage includes:

- User A denied access to foreign organization/store scope.
- Foreign and nonexistent store identifiers fail closed.
- Forged identity/scope attempts fail closed.
- Demo/Live store-mode isolation.
- Invalid, missing, malformed, wrong-type, casing, whitespace, array and
  prototype-property mode/role inputs fail closed.
- Supported persisted roles are accepted only through canonical validation.
- Unauthorized requests are rejected before the protected repository
  operation.
- Authorized requests reach the protected operation.
- Unexpected dependency failures return a safe generic error without leaking
  synthetic private detail.

An initial test run produced 50 PASS / 8 FAIL because the authored test used
the unsupported Chai/Vitest matcher `toHaveBeenCalledExactlyOnceWith`.
Only the test assertion compatibility was corrected; production authorization
logic was not changed for that failure. The rerun passed 58/58.

## Task 2 Current-Source Regression

### Vite production build

Command:

`node .\node_modules\vite\bin\vite.js build`

Result:

- PASS.
- Exit code: 0.
- 1625 modules transformed.
- Production client artifact generated successfully.
- Chunk-size warning is non-blocking and unrelated to Task 3 security.

### Current-source API bundle

Command:

`node .\node_modules\esbuild\bin\esbuild server/http/app.ts --platform=node --target=node22 --packages=external --bundle --format=esm --outfile=dist/vercel/api.mjs`

Result:

- PASS.
- Exit code: 0.
- Fresh `dist/vercel/api.mjs` generated from the current Task 3 source.

### Fresh Vercel bundle regression

Command:

`node --test tests/vercel-bundle.test.mjs`

Result:

- PASS.
- 1 test passed / 0 failed.
- Exit code: 0.
- Native ESM deployment entry preserved health behavior and fail-closed
  webhook/internal-worker authorization guards.
- This run used the freshly generated current-source API artifact, not the
  stale pre-existing artifact referenced by the earlier BLOCKED report.

## TypeScript / Diff Integrity

TypeScript:

`node .\node_modules\typescript\bin\tsc --noEmit`

- PASS.
- Exit code: 0.

Git diff integrity:

`git diff --check`

- PASS.
- Exit code: 0.
- LF-to-CRLF messages are Git working-copy warnings, not diff-check failures.

## Task 1 / RLS Regression Boundary

- Task 1 migration files unchanged: PASS.
- No Task 3 changes under `supabase/migrations`.
- No changes detected to `.env*`, `supabase/**`, `vercel.json`,
  `.github/**`, `package.json`, or `pnpm-lock.yaml`.
- Task 3 remains scoped to the expected six files.
- Existing Task 1 RLS/GRANT foundation was not weakened or modified.
- No new live-database RLS execution was required to claim a Task 3 database
  change because Task 3 made no migration/RLS change; previously verified
  Task 1 database evidence remains the baseline.

## Secret / Credential Safety

Targeted secret-pattern scan across all six Task 3 files:

- PASS.
- No matching credential material detected.
- No environment values or provider secrets were intentionally read, changed,
  or committed during manual verification.

## Scope

Expected Task 3 files:

- `server/foundation/context.ts`
- `server/foundation/postgresTenantRepository.ts`
- `server/http/app.ts`
- `server/phase1.ts`
- `docs/PHASE1_TASK3_SECURITY_EVIDENCE.md`
- `tests/phase1-http-authorization.test.ts`

No Task 4/5 implementation was performed.
No Salla configuration was changed.
No Vercel project configuration was changed.
No financial logic or UI behavior was changed.

## Current Closure State

Local required Task 3 implementation/security/build regression gates described
above are now PASS.

Task 3 is NOT FINAL CLOSED yet.

Remaining closure gates:

1. Final post-addendum diff/integrity review.
2. Create commit:
   `feat: harden phase1 tenant authorization`
3. Push `engine-integration`.
4. Verify remote branch points to the exact Task 3 commit SHA.
5. Verify GitHub Actions `Phase 1 foundation checks` completes successfully
   for that exact SHA.
6. Verify final local worktree is clean.
7. Ayman/ChatGPT final evidence review and closure decision.
