# API-TEST

Status: COMPLETE — isolated mounted API proof.

## Source boundary

- Worktree backend-tree SHA-256 (no `Cargo.lock`): `6e671915da1b94ffa242d35f7df7c8cb2c5e3d1d9bf2218416fc4427dd7e79d6`.
- Canonical migration unchanged: `20260907000001_consolidate_project_members.sql` SHA-256 `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a`.
- Remote fixture normalized 14 historical migration files CRLF→LF only for runner compatibility. Canonical new SQL and migration runner not edited.
- Regenerated `backend/schema.graphql` SHA-256: `a245990f4a6876667ecb55124737efe17604f8a1f8cb1a9d9fddfddb1d518e32`.
- Changed: clone resolver, resource-member resolver, mounted flow, root/nested contracts, generated SDL. No web/Gantt/config/package changes.

## Final results

```text
targeted rustfmt --check                                      PASS
Git diff --check                                              PASS
DATABASE_URL=[redacted read-only metadata] cargo test --test contract --offline
                                                               PASS 29/29
DATABASE_URL=[redacted metadata] TEST_DATABASE_URL=[redacted owned DB]
  cargo test --test herdr_flow --offline -- --test-threads=1  PASS 1/1
```

Final mounted flow ran single-threaded on final source. SQLx compile metadata read only `gm_rehearsal`; runner/runtime writes used only `gm_api_verify_20260907`.

`cargo check --locked --offline` cannot run: snapshot has no Cargo.lock. Plain check without metadata fails as expected because 17 SQLx macros require `DATABASE_URL`; final contract and mounted tests compile the tested backend with supplied read-only metadata. Explicit Cargo executable was used because remote noninteractive PATH lacks `cargo`.

## Mounted proof

- Selective clone: 3 copies/3 roots/12 IDs, parent maps, assignment handling, field rules, nested clone, invalid input zero-writes, trigger-injected full rollback.
- Source integrity: corrupt root-child cycle and moved descendant reject with no writes; fixture restored.
- Flat tree: auth/read denial, all depths once, deletion exclusion, deterministic parent-first order.
- Canonical member/link/revoke/regrant/account-delete and assignment atomicity/mismatch/cross-project/non-MEMBER cases.
- Owner canonical row/read; manager peer cannot revoke owner; caller cannot mutate own access.

## Fixed defects

1. Clone NULL enum bound as `None::<String>`; changed to `None::<TaskProgressType>`.
2. Access mutation allowed peer owner revoke/self mutation; it now locks target/owner context and rejects self or protected target mutation.
3. Contract `},{` delimiter fixed; clone/tree SDL shape pinned.
4. Stale resource write-guard count updated from 3 to 5, plus per-mutation/per-query guard assertions. This retains meaningful authorization coverage; final full contract passes.

## Isolation cleanup

- Before destructive actions verified TESTENV container labels, loopback `127.0.0.1:55435`, exact DB, and API-root marker.
- Pre-LF-reset backup hash: `ccfacfc3eda2cb2d242e3a19a2a063c1424b098eb4094a5cf26f3a2d0e0ced11` (16,655 bytes); no secrets/data printed.
- Final cleanup PASS: API DB dropped; catalog count is zero; owned remote API root/cargo target/logs removed. TESTENV container and other DBs untouched. Before cleanup, history had 15 rows; `project_members` table and `resource_members` view existed.

## Coverage limit

No concurrent link/revoke/assignment race test; no speculative redesign. Populated historical upgrade remains migration-artifact scope; API-TEST proves LF fresh bootstrap and API behavior.

## Unresolved questions

None.
