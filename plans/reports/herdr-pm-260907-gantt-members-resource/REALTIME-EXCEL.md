# REALTIME-EXCEL requirement mapping

Status: RELEASE_IN_PROGRESS_WITH_CONCERNS

| Requirement | Evidence | State |
| --- | --- | --- |
| Integrate exact frontend change | Source `a176c59b68705e37ca97441ad1e3e4f5055548db`; cherry-picked as `2d44757bab6dcd24a7b173723681043dbf4d92e0` | Done |
| Authoritative task updates | Shared GraphQL task fragment, one normalizer, recursive Redux tree upsert | Done |
| List/modal/Excel reconciliation | Mutation-returned tasks replace matching task state; no confirmed local field guesses | Done |
| Excel edit safety | Scroll/focus preservation and dirty leave guards | Done |
| Focused regression checks | New realtime and grid-guard suites pass; existing Excel suite passes | Done |
| Existing assignment checks | Two existing assertions fail when mutation fixtures omit preserved fields (`description`, `effort`) | Concern |
| Production release | See `RELEASE-REALTIME-0908.md` | In progress |

Focused result: 5 suites / 39 tests; 3 suites and 37 tests passed, 2 suites and 2 tests failed. React `act(...)` warnings also remain in the existing Excel suite.

Unresolved questions: none.
