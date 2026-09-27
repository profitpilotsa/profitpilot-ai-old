# ProfitPilot AI — Agent Gateway

This file is a concise operating gateway. The Obsidian vault remains the durable
project knowledge layer; repository code, tests, CI, and runtime evidence remain
authoritative for implementation behavior.

## Start Every Session

1. Read `C:\Users\Ayman\ProfitPilot-Knowledge\00 - Project Control\CURRENT STATE.md`.
2. Read `C:\Users\Ayman\ProfitPilot-Knowledge\00 - Project Control\AI AGENT INSTRUCTIONS.md`.
3. Classify the assigned task, then retrieve only the relevant knowledge below.
4. Work only within the assigned boundary. Do not start the next phase or task without approval.

## Knowledge Routing

| Task | Read only this additional vault note first |
| --- | --- |
| Architecture / foundation | `01 - Locked Decisions\FOUNDATION & ARCHITECTURE.md` |
| Financial / profit / cost / cash | `01 - Locked Decisions\FINANCIAL TRUTH & INVARIANTS.md` |
| Security / Demo / Live / authorization | `01 - Locked Decisions\DEMO LIVE & SECURITY.md` |
| UI / product page | `02 - Product Design\17 MAIN PAGES.md` |
| Testing / QA | `03 - Testing & QA\TESTING PROTOCOL.md` |
| Phase 1 execution | `00 - Project Control\PHASE 1 EXECUTION.md` |

Do not load the entire vault or unrelated notes by default.

## Retrieval Workflow

`CURRENT STATE → task classification → relevant knowledge → search → targeted code → implementation → tests → evidence → learning proposal if warranted`

- Search before reading large files.
- Prefer exact search, symbol search, a targeted file read, then the minimum dependency chain.
- Use `rg` first for repository navigation unless evidence shows it is insufficient.
- Avoid full-repository scans, full-vault reads, generated content, caches, builds, logs, and unrelated context.

## Historical-First Rule

Before proposing or implementing a supposedly new feature, workflow, page, or behavior:

1. Search relevant project knowledge and implementation.
2. Check whether it is already implemented, locked, rejected, or functionally duplicated.
3. Inspect relevant history and tests where needed.
4. Do not redesign settled ProfitPilot behavior from scratch.

## Financial Truth — Stop-Level Rules

Read the authoritative financial note for full requirements. Always preserve:

- Unknown != Zero; Expected != Actual; Pending != Actual.
- Estimate != Confirmed Financial Fact; Inference != Fact; Prediction != Fact.
- Profit != Cash; Approval != Payment.
- No Silent Rewrite; No Double Counting; No Automatic Cost Allocation.

AI, Admin, UI, and infrastructure must not directly fabricate or silently mutate
authoritative merchant Financial Truth.

## Demo / Live Security

- Demo and Live remain strictly isolated.
- Simulation data must never contaminate Live.
- Demo must not invoke Live provider actions.
- Fail closed when authorization or security scope is ambiguous.

## Testing and Evidence

- Evidence before PASS: reasoning or compilation alone is insufficient.
- Apply the relevant Testing Protocol and run targeted tests plus required regression.
- Report PASS, FAIL, BLOCKED, or UNKNOWN truthfully with evidence.

## Secrets

Never expose or persist API keys, tokens, credentials, `.env` contents, provider
secrets, service-role credentials, production private data, or encryption keys in
AGENTS.md, Obsidian, logs, generated maps, prompts, commits, or reports.

## Git

Git push is manual. Agents may inspect, test, and prepare or create local commits
only when explicitly authorized. Never push automatically.

## Learning Loop

`Execute → Observe → Verify → Learn → Reuse → Improve`

Use `04 - Verified Learnings\LEARNING UPDATE PROPOSALS.md` for evidence-backed
candidates only. Do not promote discoveries to permanent knowledge, modify this
gateway, or create Skills without explicit approval.
