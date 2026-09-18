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
| 3 | Identity, organizations and permissions | 2 | **done** | `2026-09-17-phase-3-identity-organizations-permissions.md` | **Fully complete.** All 12 tasks + a final whole-branch review + its one fix-forward task (PR #57 — production CORS had never been configured, a deploy blocker; the 404 error envelope was degrading to a generic code) all merged to `dev`. 4 full plan review/fix rounds before implementation, every task independently reviewed after, catching several real privilege-escalation-adjacent bugs along the way. Two real frontend bugs found during Task 12's walkthrough (verify-email double-submit UX bug; concurrent refresh-token race) deferred as standalone follow-up task chips, not blocking. See ledger for full detail. |
| 4 | Brand/model taxonomy | 3 | **done** | `2026-09-17-phase-4-brand-model-taxonomy.md` | All 8 tasks merged (PR #22, #23, #26). |
| 5 | Directory consolidation | 3, 4 | **ready** | `2026-09-18-phase-5-directory-consolidation.md` (merged, PR #34) | 17 tasks, ~5780 lines. Review → fix → re-review cycle: found 1 Critical (colliding test fixture data) + 6 Important, all fixed and independently re-verified at the code level (2 residual stale cross-references from a task renumbering caught and fixed in the same PR). Publication-gate deferred to Phase 17 with a corrected justification. **READY TO IMPLEMENT.** |
| 6 | Shared inquiry and messaging core | 3, 5 | idea | — | |
| 7 | Contact privacy and reveal access | 6 | idea | — | |
| 8 | Finance configuration and calculation engine | 2 | **done** | `2026-09-17-phase-8-finance-calculation-engine.md` | All 8 tasks merged (PR #19, #20, #24). Formula independently cross-verified against spec twice. First phase (besides 0/1) fully complete. |
| 9 | Finance UI and broker listing flag | 4, 8 (see note) | idea | — | **Ruling:** the spec's own dependency table lists only 4,8, but §18's actual content (`listing.seller_type`, `listing.show_finance_estimate`, `listing.price`, `listing.status`) requires the `BoatListing` model that Phase 11 defines. Real dependency is 4, 8, **and 11**. Do not plan/implement Phase 9 until Phase 11 has at least merged its `BoatListing` model. |
| 10 | Listing view analytics | 3, 4 (see note) | idea | — | Same issue as Phase 9: needs `ListingView`/`BoatListing` from Phase 11 in practice, not just 3,4 per the spec table. Defer until Phase 11 lands. |
| 11 | Listing workflow and immutable snapshots | 3, 4 | **implementing** | `2026-09-18-phase-11-listing-workflow.md` (merged, PR #33) | 15 tasks, ~7780 lines. Tasks 1-14 merged (PRs #36,#39,#40,#42,#44,#46,#47,#49,#50,#52,#55,#58,#60,#63). Task 14 shipped the first public `AllowAny` endpoints (`GET /api/v1/listings/`, `GET /api/v1/listings/<id>/`) — adversarially leak-tested, no leak found, one throttle gap found and fixed before merge. Only Task 15 remains: phase acceptance tests, the final task. See ledger `.superpowers/sdd/2026-09-18-phase-11-listing-workflow/progress.md` for full detail. |
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
