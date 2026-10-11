# CATALOG-INTEGRATE

**Status: DONE_WITH_CONCERNS — 2026-09-07 19:22 Asia/Bangkok.** Cohesive immutable candidate assembled, module-tested, built, documented, and archived. Independent Astra review and release-worker deployment/Chrome gates remain external; this worker did not self-approve or deploy.

## Immutable candidate

Oldest new commit first:

```text
616fa2838015e104fbab89a9eba56f3c588f7614 feat(backend): integrate project task catalogs
81fbbc48174621824192367c02e99b4e9fee274c feat(web): integrate project catalogs and master phases
bd5a948bac307eec4152a3c0bc15e6b664b7b990 fix(web): close catalog integration type seams
f921253538180e7e968b3491f75b830cfd28b6b9 docs(architecture): document project catalog contracts
```

`bd5a948…` is the exact source commit with the final successful web build. `f921253…` is its docs-only child and final release archive commit.

```text
Archive: C:/Users/TienVNV/AppData/Local/Temp/projectmanager-catalog-release-f9212535.tar
Command: git -c core.autocrlf=false archive --format=tar -o <archive> f921253538180e7e968b3491f75b830cfd28b6b9
SHA-256: 7c11cf22eb9298e72fc14b329131086e2738218f2b19832f1a59d41dc5ffc84e
```

Direct tar parser verified **1,567/1,567 archived file/symlink entries byte-equal to final Git blobs**, zero missing tree blobs, all 16 migrations present, and Cargo.lock present. This retains the previously verified 14 historical LF/SHA-384 identities, canonical migration 15 SHA-256 `72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7`, catalog migration 16 SHA-256 `63135ecd312d8dbf1292760775aa6e576b409e17823c942ad382b7475e6946d3`, and Cargo.lock blob SHA-256 `9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc`.

Frontend review input: `CATALOG-INTEGRATE.frontend-source-manifest.json`, **36 paths**, manifest SHA-256 `fcf3baab7b7daeaf485f741949064c72412607aec309991b5c65497ecc23ed94`.

## Frozen imports and ownership

- Catalog UI manifest `afff253fdda374f49197bf498f0cc9fdb274d08377d2878b5b78e56e6d7f018a`: 19/19 source and destination raw hashes matched.
- Dashboard final report hashes: 4/4 source and destination matched.
- Master owned manifest: 11/11 source and destination matched. Its five copied read-only UI dependencies were excluded; final UI won and those five destination hashes were reverified.
- Backend frozen manifest: 17/17 source and destination matched. No whole-tree copy.
- Old Gantt/List/Members/clone worktrees were not reimported. Existing `049a6c5…` content remained ancestry authority.

No dependency/lock/historical-migration edit. Static SDL/wire comparison confirmed the frozen API names and shapes: task outputs expose three nullable UUID catalog IDs; create/update inputs use nullable IDs; catalog create/update/reorder documents use exact backend input names; task queries/mutations request all three IDs; backend create/update preserve value/null/omit semantics; clone copies all three IDs.

## Integration seam corrections

Four narrow test/compatibility changes are explicitly included in the 36-path review manifest:

1. Master fixture expected a false `Unclassified / not recorded` row even though final UI-owned normalization correctly retained its camel `progressCatalogItemId`; expected rows now remain configured `Creation` plus empty `Review`.
2. Gantt's local executable GraphQL fixture SDL now accepts the three additive Task catalog fields selected by the final query.
3. Dashboard converts `Map.values()` with `Array.from` instead of spread; behavior unchanged, but current repository TS target no longer emits TS2802.
4. Superseded W3 create fixture now checks stable `progress_catalog_item_id` and absence of submitted legacy `progress_type`.

No semantic conflict choice was invented: final UI ownership and the frozen wire contract determined each correction.

## Verification

Final required groups passed in owning isolation; counts overlap and are not summed:

- Catalog UI: **3 suites, 12/12 PASS**.
- Dashboard: **1 suite, 6/6 PASS**.
- Retained ProjectDetail parent contract: **1 suite, 9/9 PASS** with Temp-only general `@/*` alias; repository Jest config itself lacks that mapper.
- Master focused after seam correction: **4 suites, 71/71 PASS**.
- All affected Timeline: **6 suites, 49/49 PASS**.
- Lifecycle/resource: **4 suites, 40/40 PASS**.
- Final post-TSC-fix dashboard + W3: **2 suites, 25/25 PASS**.
- Backend producer evidence consumed: mounted catalog **2/2**, existing contract **29/29**, restored history 14→16 preservation PASS.
- `npm run build` at exact source commit `bd5a948…`: **exit 0**, compile and 11/11 static pages complete. Configuration explicitly skipped type validation and linting. Raw: `C:/Users/TienVNV/AppData/Local/Temp/catalog-integrate-build-bd5a948.log`.
- Full unfiltered `tsc --noEmit --pretty false --incremental false`: **exit 2**, not a clean pass. Final: 294 diagnostics = **290 source + 4 generated `.next/types`**. Against integrated `049a` evidence (296 source), normalized unique signatures show **0 added source, 2 removed**. Raw: `C:/Users/TienVNV/AppData/Local/Temp/catalog-integrate-tsc-bd5a948.log`.
- Final `git diff --check`: PASS. Final status only inherited `?? NUL`.

Failures were retained, not waived: initial parent run could not resolve a missing repository alias before loading; Temp alias rerun passed 9/9. First Master integration run was 70/71 and exposed correction 1. One broad all-in-one Jest run had 100 passes plus failures from the now-fixed local SDL and cross-file Apollo mock interference; final owning isolated runs above are green. First archive verifier could not start because Python is unavailable; dependency-free Node tar verification then proved all 1,567 entries.

## Documentation and retained resources

- `docs/system-architecture.md`: project-scoped multilingual stable-ID catalogs, task selectors, all-depth dashboard totals, phase-only Master, WBS/historical-unknown behavior.
- `docs/deployment.md`: ordered forward migrations 15/16, backup/checksum/locked-source/readiness and restore rollback constraints. No deployment claim added.
- Release `web/node_modules` junction retained for the read-only reviewer/release worker, still targeting `gm-20260907/web/node_modules`; package/lock matched and no install ran through it.
- `.next` contains this worker's final successful build outputs and is transferred to release/review ownership. No owned Node/Jest/tsc process remains.

## Remaining gates / concerns

- Independent Astra assembled review is pending; candidate is not independently approved by this worker.
- Release worker owns optimized locked backend artifact, production backup/migrations/readiness, Vercel deployment, and released Chrome/persistence checks under the user's early-deploy steering.
- Existing repository TypeScript baseline remains non-clean; build skips types/lint.
- Existing disclosed `UserDashboard.test` runtime `TaskStatus` load failure was not introduced or changed.

## Unresolved questions

None.
