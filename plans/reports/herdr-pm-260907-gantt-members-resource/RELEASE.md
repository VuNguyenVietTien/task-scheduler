# RELEASE

Status: **DONE_WITH_CONCERNS — Ubuntu deployed/verified; dedicated owner deployed Vercel81fbbc48; later web fixes and Chrome acceptance remain.**

Frontend: **https://prjmngr.vercel.app** — READY, login redirect followed to HTTP200, anonymous auth401.
Backend: **https://pm-api.khampha.dpdns.org** — local/public HTTP200, `ready/up/current`, all16 migrations. Final verification2026-09-07 19:33, Asia/Bangkok.

## Authority, checkpoints, ownership

- Dispatch18:54 +07, deadline19:34; gm-release / w1:p2R; openai-codex/gpt-6-astra max. Checkpoints19:00,19:06,19:18 before production,19:22 after smoke. Nominal20-minute checkpoint delivered19:18, four minutes late; still before production change.
- Primary startup docs read in order including deployment; AGENTS/global rules, active plan/acceptance/decision/project ledgers; DESIGN§11, PREFLIGHT, TESTENV, migration artifact/authority/final/closure reports; Gantt/List final authority and integration reports; catalog API/backend/UI/Master/dashboard, latest CATALOG-INTEGRATE and independent backend-review checkpoint.
- Latest user18:51 steering applied: necessary modules + immutable build + PM release message permit deployment before independent/full integration review. PM supplied backend616fa283, then explicitly opened combined81fbbc48 cutover. No repeat approval request; no review PASS invented.
- At19:18 PM transferred Vercel to **gm-vercel-now/w1:p2T**. This worker had prepared staging/script only: **no Vercel dry/deploy/alias mutation or active Vercel deployment job**. No nested agents.
- No product/SQL/lock/source fixes, primary user edits, commits/push, moving-tree cloning/copying or integrator worktree/build/junction changes. Primary write only this report. Operational scripts/evidence in positively owned release roots.

Paths used below:

```text
R=/home/azuraith/task-scheduler/releases/20260907T1204-616fa283
P=/home/azuraith/task-scheduler/rehearsals/gm-20260907/preparation-verification
L=C:/Users/TienVNV/AppData/Local/Temp/gm-release-20260907-1854
```

## Exact artifact identities

| Artifact | Identity |
|---|---|
| Deployed backend Git | `616fa2838015e104fbab89a9eba56f3c588f7614` |
| Backend Git tree | `7267d3a1a4b211d482e22ba57db5dfe4adf456bb` |
| PM early combined Git | `81fbbc48174621824192367c02e99b4e9fee274c` |
| Early combined Git tree | `9c324dff824744a354f1e5d3b01d0be8e05d6775` |
| Final backend archive | `R/backend-616fa283-release.tar` |
| Backend archive SHA256 | `e0b6e70c50c07f7d223fc4355be28427acd6dca478dce95317a4f78315ff2cb1` |
| Early web-only archive SHA256 | `5ec88490139f444cc33061b193b6c2dc5edcf8ea41fcc9b14b95991794ee42de` |
| PM early full archive SHA256 | `0aaeb6a768a0d10cde945a75de6212c225c2c4fd39586382cf1aaad6f18aa843` |
| Image tag | `task-scheduler-backend:20260907T1204-616fa283` |
| Immutable image ID | `sha256:7519a13b20bee346a393f0d938af1b3bf971fd5a534672367e226ca22dec98af` |
| Serving application SHA256 | `e7db9ed14338e27ebcb7bdbfedbba33c989a8c890eea9b587aea60f57789b373` |
| Optimized migrate SHA256 | `ab9cfd1656a0b90b96ab29d87b2bd11b3d0257fba41b072e2c9d97dd4befa30f` |
| Cargo.lock canonical LF SHA256 | `9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc` |
| Cargo.toml canonical LF SHA256 | `2fac8d30de67576b039d219ad8157498f18e81904683ba678b2542b0d408efa0` |
| Canonical15 SQL SHA256 | `72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7` |
| Catalog16 SQL SHA256 | `63135ecd312d8dbf1292760775aa6e576b409e17823c942ad382b7475e6946d3` |
| Operational cache Dockerfile SHA256 | `1651f60c72d1e82549568c29139d2750765368c26c7a04832049ce9dea2a6367` |
| Portable image | `R/backend-image.tar.gz`,56,905,661 bytes,gzip verified |
| Portable image SHA256 | `d4bfe2689463e10ab7f4e1083e2b67dc1e096b40be201a04527d6cb2b2fdb0c9` |

Docker image is retained locally; `RepoDigests=[]`. Image ID is content-addressed configuration identity, not a claimed registry manifest digest. Actual serving-container binary independently extracted and matched the optimized builder binary.

Controlled packaging: `git -c core.autocrlf=false archive --format=tar <SHA> -- <explicit tracked backend/.gitattributes file list excluding .env*>`. Initial archive627558c7… rejected before extraction/DB work because tracked `.env.example` existed; rejected own archives removed, rejection log retained. Only that template excluded; product bytes unchanged. No dotenv/credentials packaged. All17 frozen catalog raw hashes rechecked, committed LF identities matched; unchanged backend closure-manifest paths matched. **262 final backend files unchanged after build/testing**. Historical14 SQL compared to both deployed files and untouched stored SHA384; all16 history checks matched after actual runner and production migration. No baseline/history/checksum bypass.

Web:523/523 exported files matched exact81fbbc48 Git blobs;35/35 then-current integration manifest paths matched raw/LF. Backend diff616fa283→81fbbc48 empty. Verified primary `.vercel/project.json` copied only into `L/vercel-81fbbc48/web/.vercel`, never committed/uploaded as product source.

## Build and executable qualification

Reused immutable previous builder `sha256:ea40d72311aa61c5d1bbc2c983392be9f6caea558b66d7122c99670928e81015` and runtime `sha256:3a067fd2a531143ecbcd854a6a295fbda5d1d6614db3afe1d5109a5e96107ac7` via Docker COW layers. Operational Dockerfile removes old product source while preserving target cache, copies exact new archive, builds optimized binaries, replaces runtime application. Original source Dockerfile/dependencies untouched; parent IDs checked before/after.

```text
python3 -u R/prepare-build.py
  docker build --network host --secret id=database_url,env=DATABASE_URL
    --target builder -f R/cache-build.Dockerfile ...
  embedded build: cargo build --release --locked --offline
  same cached runtime target build
  PASS,56.65s; own metadata16 read-only and all fingerprints unchanged

python3 -u R/qualify-artifact.py
  PASS,exit0,7.49s total
  actual optimized runner14→16,ForwardOnly applied2,explicit Current16
  all16 checksums,11 preservation scopes,legacy scalar backfill PASS
  optimized normal HTTP/mounted GraphQL smoke20 checks PASS
  missing compatibility view / canonical constraint -> HTTP503 partial-schema
  exact object restoration -> HTTP200 current (OWN scratch only)
  full upgraded16 backup -> prechange14 restore -> old image Current PASS,2.89s

python3 -u R/cutover-release.py --pm-released-81fbbc48
  PASS,exit0; fresh fenced backup/restore/runner before production migration

python3 -u R/verify-production.py
  PASS,exit0;20 actual production HTTP checks plus runtime/binary/invariant proof
```

BuildKit database URL was a secret, never buildarg/image env. SQLx metadata used only inherited RELEASE-owned `gm_release_prepare_20260907` on TESTENV loopback55435; ownership/labels/root/binding checked. Every scratch reset/migration/fault preceded a verified backup. Producer catalog DB untouched. Copied retained catalog runner initialized metadata only; newly optimized runner independently requalified14→16. No compile fixture writes in production.

PM-bound module evidence consumed, not falsely called reruns: catalog backend2 mounted+29 contracts+14→16 preservation; UI12; Dashboard6 and retained parent9; Master71/49/40 overlapping groups; combined Next build exit0/11pages. Prior independent backend29+1+5+3 and preserved-role/permission/clone evidence retained. No redundant full cargo/clippy/fmt/coverage suite run here.

## Production cutover, backup and runtime

SSH `u-cf`, BatchMode, authenticated existing user on verified host. Fresh preflight old production:14 migrations/current; container2ac0ad5d…, image96b18f2f…, hostnetwork/user1000:1000/restartunless-stopped; PostgreSQL exclusively127.0.0.1:5434. Local/public readiness200. Preparation archive0b8aa9dc…, portableb105fbdc…, manifest70ad534e… and old-image restore proof independently hash-verified; **not treated as final cutover backup**.

| Event | Evidence |
|---|---|
| Writers fenced | `2026-09-07T12:18:43Z` /19:18:43 +07; old backend stopped; zero other DB client sessions |
| Fresh backup | `R/backups/production-fenced-20260907T121843Z.sql.gz`,24,633 bytes |
| Backup SHA256 | `c92de7aef33bf8454c88ce9ea83a8266b326009e462afcb06580d6b41503fa78` |
| Actual fresh restore proof |36/36 public table counts/full-row aggregate fingerprints match; old14 image Current; exact runner14→16 Current;3.4s |
| Production migration |Exit0 AND `ForwardOnly { applied: 2 }`, `Current { version: 20260907000002 } (current)`;all16 stored checksums match |
| Writers reopened | `2026-09-07T12:18:48Z` /19:18:48 +07; total operation6.07s |
| Serving container | `71b810ab986d83891e14daac566b9ba0e170ab6f640a6bff2739c337756f63cd` |
| Retained previous container | `task-scheduler-backend-prev-20260907T1204-616fa283`,stopped |
| Retained previous image | `task-scheduler-backend:20260906T0645`,ID `sha256:96b18f2fcdb6714e25a80f5a50227633cd41861fe64b0e6afaa62e2b67e02f8f` |

No old backend served new schema. Migration ran separately before startup; `RUN_MIGRATIONS=false`. Connection options bounded `lock_timeout=5000`, `statement_timeout=120000`; runner1 connection. Values passed in memory, never echoed.

Actual runtime flags: `--network host --user 1000:1000 --restart unless-stopped`, same original environment key/value map passed through `-e <key>` from memory. Environment values, network/user/restart independently compared with retained previous container. Mounts:

```text
/home/azuraith/task-scheduler/releases/20260906T0645/backend/config/config
  -> /usr/src/app/config : read-only
/home/azuraith/task-scheduler/shared/uploads
  -> /usr/src/app/uploads : read-write
R/runtime/backend.log
  -> /usr/src/app/backend.log : read-write
```

Config/upload mounts unchanged; new log path only. Old container/config/log/image/releases untouched and retained. Fresh backups include full schema/data/history, `pg_dump --no-owner --no-privileges`, restore `ON_ERROR_STOP=1`; production original owner must be used for recovery. Database creation metadata:UTF8,en_US.utf8 collate/ctype,libc provider. Postmigration catalog owner mismatches0; one explicit relation ACL exists (do not generalize old14 zero-ACL evidence to new16 grants).

Local `http://127.0.0.1:8081/health/ready` and public `https://pm-api.khampha.dpdns.org/health/ready` both HTTP200:

```json
{"status":"ready","database":"up","migrations":"current"}
```

Canonical physical checks: `project_members=r`, `resource_members=v`; no independent resource table; invalid task/member edges0. Serving binary SHA256 independently matches table above.

## Production smoke and data-retention boundary

At19:22:08 +07, actual production HTTP20 checks PASS: normal backend JWT transport; anonymous/invalid-token/outsider rejection; catalog create/multilingual labels/rename/reorder/stale conflict; display-only canonical member; task catalog set/null/omit and unlinked assignment; assignment clear preserves parent;3 cloned parents+9 children; persisted16-row/4-root tree; legacy member/plan reads; email link keeps resource handle without granting access; linked-no-access still denied.

Only bounded synthetic fixture records created: project`4228ebe6-a3e2-42bc-9ef1-7eb3937633a0`,2 synthetic accounts,16 tasks. Retained, not deleted/reset. No real user identity used for smoke. No fixture names/emails, bearer tokens or personal rows published.

Fresh pre-fixture backup: `R/backups/production-before-smoke-20260907T122208Z.sql.gz`; SHA256 `c15705e982da53960ac8018fab8ce43c6455056dc057b5227f5318b4358754e5`. **Accepted postbackup writes now exist. Automatic prechange restore is forbidden.** No production reset, restore or data deletion occurred.

JWT transport proof is not Google/Firebase browser login or Chrome product acceptance. PM/user owns that later verification.

## Rollback compatibility and exact guarded recovery

**Oldimage/new16DB is NOT rollback**: old embedded history marks new versions Ahead; old readers/writers are incompatible. Never patch history, fake Current or bypass readiness. After accepted writes, prefer forward repair/same-schema compatible release; preserve every accepted write. No same-schema older16 artifact was claimed qualified.

Executed scratch rollback: own upgraded16 backup → guarded own DB recreation → prechange14 restore → retained old runtime on unused58093;2.89s. Fresh fenced production snapshot was separately restored and old14 tested on58094 before production migration. Exact executed guards/commands in `qualify-artifact.py`, `cutover-release.py` and inherited `P/prepare.py`; these are execution evidence, not blind-rerun/idempotent automation.

The following full restore sequence is **NOT runnable under current accepted-write state**. Only after explicit accounting/reconciliation proves no accepted postbackup writes will be discarded; otherwise stop and forward-repair. Always preserve failure-state dump before restore:

```bash
# Guard currently FALSE: accepted postbackup fixture/user writes must not be discarded.
test "${VERIFIED_NO_ACCEPTED_POSTBACKUP_WRITES:-}" = yes || exit 1
R=/home/azuraith/task-scheduler/releases/20260907T1204-616fa283
PREV=task-scheduler-backend-prev-20260907T1204-616fa283
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
set -euo pipefail; set +x; umask 077
docker stop --time 20 task-scheduler-backend
# Verify zero remaining DB client sessions; no forced termination of unrelated writers.
docker exec task_scheduler_postgres sh -c \
 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -n > "$R/backups/failure-state-$STAMP.sql.gz"
gzip -t "$R/backups/failure-state-$STAMP.sql.gz"
sha256sum "$R/backups/failure-state-$STAMP.sql.gz"
docker rename task-scheduler-backend "task-scheduler-backend-failed-$STAMP"
# Original database owner/config come from retained PG container, not printed values.
docker exec task_scheduler_postgres sh -c \
 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" --template=template0 --encoding=UTF8 --lc-collate=en_US.utf8 --lc-ctype=en_US.utf8 "$POSTGRES_DB"'
gzip -dc "$R/backups/production-fenced-20260907T121843Z.sql.gz" | \
 docker exec -i task_scheduler_postgres sh -c \
 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker rename "$PREV" task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
# Require ready/up/current and compatibility smoke before reopening writers.
```

Retained previous container restores its exact environment/network/user/mount/restart contract. Retain failed/current/previous images and all snapshots. Frontend rollback separately uses actual prior deployment below; frontend rollback alone does not reverse schema.

## Vercel ownership / current evidence

Read-only preflight: CLI59.11.7, whoami exit0 with command-local `NODE_OPTIONS=--use-system-ca`; no TLS bypass/token output. Correct existing project `vunguyenviettiens-projects/task-scheduler`, projectID`prj_q4s9b505ULq8NkSwy0FDWMK0uoz3`, orgID`team_x3BJBnMaOL2NCDpQ74kb1Pv9`. Required production key names `AUTH_SESSION_SECRET` and `NEXT_PUBLIC_BACKEND_URL` present; no values output.

Actual prior deployment independently resolved before release:
- ID`dpl_D82fpkRkvNPCZxh2k5HzifbA7w1E`.
- `task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app`,READY,production,alias`prjmngr.vercel.app`.
- Rollback reference: `vercel rollback task-scheduler-j2d76y4zf-vunguyenviettiens-projects.vercel.app --yes --scope vunguyenviettiens-projects` from correctly linked project context, system CA enabled. Not executed here.

Final dedicated-owner `VERCEL-NOW.md` received19:32: **DONE**, exact81fbbc48 deployed by gm-vercel-now, not this worker. READY19:25:49 +07 /12:25:49Z; deployment **`dpl_G3uaGFRjJgXKU9iJbAv1FMSBNP46`**, URL **`https://task-scheduler-1l9ly880g-vunguyenviettiens-projects.vercel.app`**. Alias **https://prjmngr.vercel.app** independently resolved by owner to that deployment at19:26:57; owner login response307. This worker's final read-only public HTTP verification19:33 followed `/login` redirects to200, `/api/auth/me` without credentials returned401; backend readiness remained200 ready/up/current. No Chrome/Firebase authenticated acceptance claimed.

First attempt`dpl_4sq9mp6eBBZcuiHSGLSon3wAbdC9` rejected before build because linked Root Directory`web` required its parent upload root. Dedicated owner corrected OWN staging only, project/product configuration unchanged; retry completed and owner reports no remaining Vercel process. Later f9212535 artifact arrived after that retry completed; no duplicate deployment was started.

Version distinction relayed to PM: early authorized/delegated web is81fbbc48. Integrator later produced source`bd5a948bac307eec4152a3c0bc15e6b664b7b990`, docs child`f921253538180e7e968b3491f75b830cfd28b6b9`: dashboard `Array.from` type correction and W3 test expectation. Backend unchanged. Final archive SHA256`7c11cf22eb9298e72fc14b329131086e2738218f2b19832f1a59d41dc5ffc84e`. Dedicated Vercel owner/PM must identify deployed frontend SHA and reconcile any follow-up; this worker does not silently replace its approved artifact.

## Retained evidence and cleanup

`R/release-artifact-manifest.json`:92 artifacts, SHA256 **`928de71f599170c06c0f7223142fb9ef35a1e4ce826dbcb49f03bf4e64661bc5`**. `R/SHA256SUMS` records all retained operational artifact hashes. Raw build/migration/test logs, `.rc` files, source/migration manifests, backups, serving-binary proof and exact scripts retained. Sanitized manifest/results copied to`L`; no production dump/row/credential download.

Key evidence under`R/evidence/`: `build-result.json`, `source-manifest.json`, `migrations.json`, `qualification-result.json`, `isolated-http-smoke.json`, `new16-readiness.json`, `final-backup-restore.json`, `production-migrate.{out,rc}`, `ubuntu-release-result.json`, `production-http-smoke.json`, `production-final.json`, `cleanup.json`.

Final19:25:34 +07: no owned probe containers/jobs/listeners;58081/82/83/92/93/94 free; own DB other sessions0. Inherited release-owned `gm_release_prepare_20260907` retained on shared TESTENV55435, finalhistory16. Runtime/builder images, archives, snapshots and original preparation assets retained. Root700; backups/evidence700 and sensitive files600. Keep shared TESTENV and other owners' DBs/source/caches untouched. Intentionally running production backend/PostgreSQL remain, not orphan jobs. No Vercel job belongs to this worker.

Failures disclosed: Python urllib public preflight403, while curl independently200; no TLS/infrastructure change. Initial sample-dotenv archive rejected before extraction, corrected by explicit exclusion. No failed build/qualification/cutover/smoke hidden. Dedicated Vercel Root Directory rejection is separately attributed, not this worker's deployment.

## Validation limits / remaining gates

- Full TSC not clean and Next skips lint/types. Latest integrator finalbd5 evidence: exit2,290 source+4 generated diagnostics;0 added normalized source signatures versus296-source049a baseline;25 post-fix tests and final build PASS. That later evidence is **not** silently attributed to early81f web bytes. Full cargo/clippy/fmt/coverage and full browser acceptance not run here.
- Independent catalog review runtime stopped with content-risk flag; **INCOMPLETE, not PASS**. Its actual14/15/empty→16 migration checks passed. PM authorized parallel release and separate narrowed functional concurrency check; no executed blocking counterexample had been relayed at report time.
- Vercel deployment ID/READY/alias/login gates now complete as attributed above. Frontend later-fix version reconciliation, narrowed functional review and PM/user Chrome acceptance remain external. Any demonstrated defect goes to bounded owner fix/redeploy; no automatic DB rollback/write discard.

## Exact migration SHA384 ledger

All14 historical values match archived LF, deployed files and unchanged database records;15/16 match final embedded runner and production history.

```text
20230705000001 d29352e3a179e0cfd192cb1675cd810faff57dc688d55121e84a3ad440a3a111c9ad3efcb968c7cea32f7eeedfcf62e8
20240616000001 ed4f4682a66fe0072b1d6ba1d6fb9c44fbd677ccdbfca58036f122ad5b4b8fb539b8b0c7b6d79d74940a37dc442eb62b
20250319000000 bf5bde0370b5ee9f90137742755cf791c19e193f87c23f5e721e29f3af4bb144d60f0f733aeef0ad8747de4629b8ff59
20250408000000 6227b5dffff8793398776aa3231b377cc3e9d2e9084842c8c08f41be606c5525349adddc703838ec37c3b0bba0ee0d4a
20250501000000 c9b71ae77c0a112562265683c25248bbf229a2202bb46aef7da8a516376bf9f01b1ccd62782cfc081dced0001f0aeaec
20260325000000 77bca6214624d62869050f1122fe0d90ec3b3157c536308add8f02552231a7d6296cb540f3a8ca4aed159eabe345a6a0
20260328000001 8a2664ff5f52a55e8337def87cad5761961408b08769d3bbd2cbe6ba75f43dd5c198c04cee1211ba2456f325cd5c06ee
20260901000100 94ad372b623d3318d9af3fd952538ac56a45e3ae4085057f6e0e93152df72a658ba7978e323ed00915fbc9a5b475d1dd
20260901000200 f1a05054a918758201b0a5b6b9d5c618fa1833c844dd2a92d9c5845a4e079ec96402e55346a694acdc2b4d44416eb241
20260901000300 a74348f30008a8b0ec704340d2195dab96940d302453c148ae186578f837e8667711c981913eb357381586038bd1cc46
20260905000001 ac498d734971ea883e60e064e014c8f1385258f9d0697c69fda48df2bf0bb5a47eb5cd7565173e79248d5436c2362ddd
20260905000002 33323e62ea506e58d8fbc9375c5a9fbd595ed4035fd6c37fab4627d9bf02e535196752334869170610884f40db0ffe16
20260906000001 06689582ff44a29ff9e2438e18fd66a0735f549d3490f6dade01a87b51a1231f7afac52f38ac3ff09db5ac999bf16c29
20260906000002 310d49ea93d9554db24ee9d3de6ec74997edcaaf7ef66b600ecc3944f31ef6ebefcf1d0ea5097cb817fbe4e2d9fee949
20260907000001 73b918dc1d6bba51e947163dbfabfde744fa9ff12419f34a56ce5a45a46a5f7acd42047d6b7f48f62b5df311b8ba11a1
20260907000002 7c9d1a05617a31a19f1a04af83a30c066fb05fbba0b53de909405d70f2f59cd5f8a2fced10fa636dd584bc74dfd6ccec
```

Unresolved questions: no additional product/permission decision requested; external frontend/review/Chrome gates above remain.

Report: `C:/Users/TienVNV/Documents/prjmngr/task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/RELEASE.md`

Status: **DONE_WITH_CONCERNS**
