# RELEASE-PREPARATION

Status: **DONE_WITH_CONCERNS — preparation PASS; not release approval.**  
2026-09-07 17:55 Asia/Bangkok; dispatch17:34, checkpoint17:42, deadline17:59. Pane **w1:p2G**, route `openai-codex/gpt-6-astra max`. No nested agents.

## Immutable release assets

Owned remote root (**R** below):
`/home/azuraith/task-scheduler/rehearsals/gm-20260907/preparation-verification`

| Identity | Exact value |
|---|---|
| PM-supplied Git commit | `1f63e251daee568f50e313baab9adc84de80b6cd` |
| Image tag | `task-scheduler-backend:gm-release-prepare-20260907-1f63e251` |
| Immutable local image ID | `sha256:3a067fd2a531143ecbcd854a6a295fbda5d1d6614db3afe1d5109a5e96107ac7` |
| Source archive | `R/backend-1f63e251.tar` |
| Source archive SHA256 | `0b8aa9dc0c92c7d37104dfa06587d8cddc6e2b170bec601464ac289af6e68003` |
| Portable image | `R/backend-image.tar.gz`, 49,461,739 bytes; gzip verified |
| Image archive SHA256 | `b105fbdc58798fc716ab7555db8ed5c487b9064ecedc94415761116b7ea88a49` |
| Release application SHA256 | `bea1be9eed5260bd9f93d9549ac48d886941160c4b81e733f03136c4189086c9` |
| Release migration executable SHA256 | `1920fd160cf83393457597a8ac89b48653916296e996bd967354eb1159d0eff2` |
| Canonical SQL SHA256 | `72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7` |
| Cargo.lock SHA256 | `9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc` |

Image is **local**, not published; `RepoDigests=[]`. Image ID above is Docker's content-addressed configuration digest, not a claimed registry manifest digest. Portable image and pinned parent image digests are retained.

Controlled archive command:

```text
git -c core.autocrlf=false archive --format=tar --output=<owned archive> 1f63e251daee568f50e313baab9adc84de80b6cd backend .gitattributes
```

Independently matched integrator archive hash and **226/226** closure-manifest raw/LF identities. All **260** archived regular files remained byte-identical after preparation. Fourteen historical SQL files contain no CR and match both deployed files and untouched SQLx SHA384 checksums; full list in artifact manifest. No moving-tree packaging, SQL/history edits or checksum bypass.

**Cargo.toml byte distinction:** reviewed Windows checkout `6ef60df99d4df3bcf2c2355ae83374d1b4086296f5e77b3e373aa5cfa7e2b247`; archived LF `2fac8d30de67576b039d219ad8157498f18e81904683ba678b2542b0d408efa0`. The latter exactly matches closure manifest's LF identity. No dependency/content change or new resolution.

## Optimized build and actual executable proof

Unmodified archived Dockerfile; BuildKit `database_url` **secret**, never build argument. SQLx metadata used only owned scratch DB `gm_release_prepare_20260907`, with connection `default_transaction_read_only=on`. Complete restored-table fingerprints still matched after compilation.

```text
docker build --network host --progress plain \
  --secret id=database_url,env=DATABASE_URL \
  --target builder -t <own-tag>-builder <exact-archive>/backend
# Dockerfile executes cargo build --release --locked
# Then same cached build, default runtime target, own final tag.
```

Both build exits **0**; Cargo explicitly reported **release [optimized]**, 1m40s. Total builder/runtime assembly **111.43s**. Runtime image140,537,163 bytes. Existing compiler warnings retained. No plaintext secret in image history; no DATABASE_URL in final image environment. Migration binary exported from the same builder to `R/bin/migrate`; final runtime application independently extracted and hash-matched builder output. Final image intentionally contains only the application; runner is retained separately and was mounted read-only into that image for execution.

No redundant 29+1+5+3 suite rerun: independently approved frozen bytes matched. This node tested the actual optimized runner and application, not a debug substitute.

## Consistent backup, upgrade and rollback

Production backup: `R/backups/production-20260907T104121Z.sql.gz`, UTC10:41:21 / Bangkok17:41:21; **24,626 bytes**.
SHA256: **`50211729a4b61f2b7f12b35a6eae95f3bcf8abc342e5aa9578053f44110b2d8e`**.

Read-only exported PostgreSQL snapshot shared by `pg_dump` and baseline queries; gzip integrity passed. Full schema/data/history restore with `ON_ERROR_STOP=1` passed in **0.58s**. **36/36 public table counts and full-row aggregate fingerprints match**. Baseline:14 migrations,2 access members,5 resources,181 tasks,2 plans,8 timesheet entries. No rows or personal data downloaded.

Dump uses `--no-owner --no-privileges` for cross-instance rehearsal. Production inventory:137 non-system relations, all owned by configured dump user, zero explicit relation ACLs. Any later approved production restore must use the original production owner; this is not a cluster-role backup.

| Actual proof | Result |
|---|---|
| Old production image + restored14, loopback58081 | HTTP200 `ready/up/current`; stopped |
| Optimized runner + restored14 | Exit0; `ForwardOnly { applied: 1 }`; **`Current { version: 20260907000001 } (current)`**;0.23s |
| Upgraded schema |15 successful history entries; historical14 unchanged; `project_members=r`, `resource_members=v` |
| Preservation |11 scopes match; original2 access handles/metadata and5 resource handles preserved;181 assignment relationships validated; stable task fields, plans and scheduling configuration unchanged |
| New immutable image + upgraded15, loopback58082 | HTTP200 `ready/up/current`; stopped |
| **Full rollback from upgraded15** | Backup upgraded state; guarded own-DB recreate; restore pre-upgrade14;36 table fingerprints match; old image HTTP200 on58083; **2.54s**; stopped |

Resource preservation excludes linkage timestamps/account mirrors that consolidation may intentionally normalize; original IDs and stable resource fields checked, task resource/user/project/kind relationships separately asserted. No saved-plan rewrite.

Backups preceded own restore, migration and rollback reset. Retained `restored14-before-upgrade.sql.gz`, `upgraded15-before-runtime.sql.gz`, `upgraded15-before-rollback.sql.gz`, empty-state dumps and SHA256 checksums. Exact guarded executed commands are in `prepare.py` and `verify-release.py`; these are execution evidence, **not blind-rerun/idempotent release automation**.

## Runtime identity and later rollback constraints

Production unchanged: container `2ac0ad5dbb993ef155d48858e01973e1aaf42c05872d719b75bf26be916f9800`; started `2026-09-06T05:50:55.292012585Z`; image `20260906T0645`, immutable ID **`sha256:96b18f2fcdb6714e25a80f5a50227633cd41861fe64b0e6afaa62e2b67e02f8f`**. Host network, user1000:1000, restartunless-stopped, SERVER_PORT8081, RUN_MIGRATIONS=false. PostgreSQL remains loopback5434/history14; local production readiness remained ready/up/current.

Exact retained mount contract:
- `releases/20260906T0645/backend/config/config` → `/usr/src/app/config`, **read-only**.
- `shared/uploads` → `/usr/src/app/uploads`, read-write.
- `releases/20260906T0645/runtime/backend.log` → `/usr/src/app/backend.log`, read-write.

Paths relative to `/home/azuraith/task-scheduler`. Environment **key names only** in `runtime-{before,after}.json`; secret values remained in process memory. Proof containers used separate owned log/upload paths, same UID/network contract, copied runtime settings with own DB/loopback ports and migrations disabled. No production upload/log/config write.

**Oldbinary/newDB is NOT rollback.** Later RELEASE must stop all writers, obtain another fresh consistent verified backup, and preserve current container/config/image before approved migration. Rehearsed recovery sequence: preserve failure-state dump → ensure no accepted postbackup writes → restore entire prechange DB/schema/history using original owner → start retained old image with captured flags/environment/mounts → require local/public Current readiness. After accepted writes, **no automatic restore/discard**; reconcile writes or use forward repair/same-schema recovery.

## Cleanup, evidence and remaining gates

Owned scratch retained: `gm_release_prepare_20260907`, gm_tester, TESTENV loopback55435, restored14 state. Upgraded15 dump retained separately. Root/DB absence and TESTENV labels/mount/port/owner verified before allocation. Other owners' DBs/roots immutable.

Own build/verification jobs0; listeners0;58081/58082/58083 free; own-DB other sessions0. All three stopped proof containers and temporary extraction containers removed. Prepared runtime/builder images, binaries, archives/backups retained. Root mode700, sensitive evidence/backups600. Subsequent RELEASE owner owns these assets; do not remove shared TESTENV container or production assets.

Artifact manifest: adjacent **`RELEASE-PREPARATION.artifact-manifest.json`**, also `R/artifact-manifest.json`; **64 artifacts**, SHA256 **`70ad534e91a6c368b0df191fa1196e97a797a2333cf75e29dcf31323b8c8b8bd`**. `R/SHA256SUMS` covers retained files; detailed build, migration, health, preservation, restore and cleanup evidence retained.

Operational failures disclosed: initial SSH quoting/banner failures; build-launch SSH timeout while one tracked build continued. Initial finalization raw metadata comparison failed; immediate reinspection found no differing values. Destination-sorted mount comparison passed. No failed build/application check; no failure hidden.

Primary startup docs and all mandated predecessor/current reports read; root README/local rules absent, global rules used. No source edits, commits, push, production migration/restart/switchover, Vercel/Cloudflare/env changes or nested agents. Vercel auth and Chrome acceptance deliberately not claimed.

**Unresolved gates:** newly confirmed project-specific editable progress-type catalog and phase-only MasterSchedule may require backend/schema changes. This prepared `1f63e251` image is **not the final release**; retain image/caches/evidence for the next reviewed delta. Final assembled frontend review, PM release authorization, fresh writer-fenced backup, released authenticated transport and Chrome acceptance remain pending. No remaining preparation blocker; no new scope started.
