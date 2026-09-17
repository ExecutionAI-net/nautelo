# NAUTA — Multi-Phase Delivery Tracker

Cross-phase status board for the spec's 24 delivery phases (see
`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md` §7 for the full dependency table).
Each phase still gets its own plan file (`docs/superpowers/plans/`) and its
own SDD ledger (`.superpowers/sdd/<plan-name>/progress.md`) once execution
starts — this file is just the bird's-eye view across all of them, updated
by the controller at each wave transition.

Strategy (per project owner's instruction, 2026-09-17): maximize safe
parallelism — plan ahead of the current wave, run independent phases
concurrently (per the dependency table, not just adjacent phase numbers),
never merge a PR without green CI and a clean/conflict-free merge state.

## Status legend
`idea` → `planning` → `plan-review` → `implementing` → `final-review` → `done`

## Phase status

| Phase | Name | Depends on | Status | Plan file | Notes |
|---:|---|---|---|---|---|
| 0 | Repository audit and scope freeze | — | done | (folded into Phase 0/1 plan) | |
| 1 | Infrastructure and environments | 0 | done | `2026-09-17-phase-0-1-infrastructure.md` | Merged in full 2026-09-17. |
| 2 | Shared domain types and platform settings | 1 | **done** | `2026-09-17-phase-2-shared-types-platform-settings.md` | All 6 tasks merged (PR #21, #25, #27). |
| 3 | Identity, organizations and permissions | 2 | **implementing** | `2026-09-17-phase-3-identity-organizations-permissions.md` | Went through 4 full rounds of review/fix given this phase's stakes: initial 3-way review (found a real privilege-escalation chain + a broken error envelope) → consolidated 30-finding fix → adversarial 3-way re-review (found one residual authorization-retention bug on non-ADMIN demotions + significant plan/dev staleness since 3 other phases merged concurrently while this was in review) → reconciliation fix (10 more findings) → final Task-1-focused check (found one blocking startapp/test-file step-order bug) → fixed. Task 1 (custom User model + AUTH_USER_MODEL migration, highest-risk task in the project) now dispatched for real implementation. |
| 4 | Brand/model taxonomy | 3 | **done** | `2026-09-17-phase-4-brand-model-taxonomy.md` | All 8 tasks merged (PR #22, #23, #26). |
| 5 | Directory consolidation | 3, 4 | idea | — | |
| 6 | Shared inquiry and messaging core | 3, 5 | idea | — | |
| 7 | Contact privacy and reveal access | 6 | idea | — | |
| 8 | Finance configuration and calculation engine | 2 | **done** | `2026-09-17-phase-8-finance-calculation-engine.md` | All 8 tasks merged (PR #19, #20, #24). Formula independently cross-verified against spec twice. First phase (besides 0/1) fully complete. |
| 9 | Finance UI and broker listing flag | 4, 8 | idea | — | |
| 10 | Listing view analytics | 3, 4 | idea | — | |
| 11 | Listing workflow and immutable snapshots | 3, 4 | idea | — | |
| 12 | Broker policy and auto-approval | 11 | idea | — | |
| 13 | Individual quota and entitlement ledger | 11 | idea | — | |
| 14 | Stripe product and fulfillment | 13 | idea | — | |
| 15 | Media policy and processing | 13, 14 | idea | — | |
| 16 | Role-aware create/edit experience | 9, 11-15 | idea | — | |
| 17 | Staff products, moderation and taxonomy UI | 12-16 | idea | — | |
| 18 | WebSocket, email and in-app notifications | 6, 11-17 | idea | — | |
| 19 | Broker dashboard simplification and messages | 6, 12 | idea | — | |
| 20 | Public card/profile integration and responsive QA | 5-10 | idea | — | |
| 21 | Data migration, redirects and SEO | 5, 11, 20 | idea | — | |
| 22 | Security, privacy, performance and observability | all features | idea | — | wsgi.py fail-secure gap already flagged here, see Phase 0/1 plan's Known Limitations. |
| 23 | Automated QA and UAT | all prior | idea | — | |
| 24 | Deployment, rollback and post-launch verification | 23 | idea | — | |

## Execution waves

**Wave 1 (current):** plan Phases 2, 3, 4, 8 in parallel (2026-09-17).
**Wave 2 (next):** once Phase 2 plan is reviewed and merged as a plan doc,
begin Phase 2 implementation. Once Phase 3 plan is ready, begin Phase 3
implementation (can overlap with Phase 2's implementation only for the
parts of Phase 3 that don't literally need Phase 2's code merged yet —
default to sequencing 2 before 3 unless a specific Phase 3 task is proven
independent). Phase 8 implementation can start in parallel with Phase 3
as soon as Phase 2 is merged, since Phase 8 only depends on Phase 2.
**Wave 3:** once Phase 3 is merged, Phase 4 implementation can start
(and Phase 4's plan can be finalized/corrected against the real merged
Phase 3 code rather than assumptions, if anything drifted).

## Known cross-phase risk

`backend/config/settings/base.py`'s `INSTALLED_APPS` list and
`backend/config/urls.py` are shared files every new domain app must touch.
Concurrent phases both landing new apps in the same wave will each add one
line/include — expect a trivial rebase on the second merge, not a real
conflict, as long as each phase's implementer only appends its own app
without reordering or reformatting the existing list.
