"""Operational-only probe for BACKEND-AUTHORITY-FIX's three owned rehearsal DBs."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path('/home/azuraith/task-scheduler/rehearsals/gm-20260907')
OWN = ROOT / 'authority-verification'
EVIDENCE = OWN / 'evidence'
SOURCE = OWN / 'source'
DBS = {'gm_auth_upgrade_20260907', 'gm_auth_bad_edge_20260907', 'gm_auth_verify_20260907'}
os.umask(0o077)
os.environ['PGPASSWORD'] = (ROOT / 'config/postgres-password').read_text().strip()
os.environ['PATH'] = '/home/azuraith/.cargo/bin:' + os.environ['PATH']
os.environ['CARGO_TARGET_DIR'] = str(OWN / 'target')
BASE = ['-h', '127.0.0.1', '-p', '55435', '-U', 'gm_tester']


def guard(db):
    assert db in DBS and (OWN / 'OWNERSHIP').read_text().strip() == 'BACKEND-AUTHORITY-FIX'
    info = json.loads(subprocess.check_output(['docker', 'inspect', 'pm-gm-rehearsal-20260907']))[0]
    assert info['Config']['Labels']['pm.rehearsal.owner'] == 'TESTENV'
    assert info['Config']['Labels']['pm.rehearsal.root'] == str(ROOT)
    assert info['NetworkSettings']['Ports']['5432/tcp'] == [{'HostIp': '127.0.0.1', 'HostPort': '55435'}]
    assert sql(db, "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()").strip() == b'gm_tester'


def sql(db, query):
    result = subprocess.run(['psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', *BASE, '-d', db], input=query.encode(), capture_output=True)
    if result.returncode:
        (EVIDENCE / 'probe-sql-error.err').write_bytes(result.stderr)
        raise RuntimeError('SQL probe failed; secure error artifact retained')
    return result.stdout


def backup(db, name):
    guard(db)
    path = OWN / 'backups' / (name + '.dump')
    with path.open('wb') as out:
        subprocess.run(['pg_dump', '-Fc', '--no-owner', '--no-privileges', *BASE, db], stdout=out, check=True)
    return path


def restore(db, reset=False):
    guard(db)
    if reset:
        backup(db, db + '-before-reset-' + str(len(list((OWN / 'backups').iterdir()))))
        sql(db, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    with (EVIDENCE / (db + '-restore.err')).open('wb') as err:
        subprocess.run(['pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', *BASE, '-d', db,
                        str(ROOT / 'artifact-verification/backups/gm_members_verify_populated.dump')], stderr=err, check=True)
    backup(db, db + '-restored')


def runner(db, name, success=True):
    guard(db)
    env = os.environ.copy()
    env['DATABASE_URL'] = 'postgresql://gm_tester:' + env['PGPASSWORD'] + '@127.0.0.1:55435/' + db
    with (EVIDENCE / (name + '.out')).open('wb') as out, (EVIDENCE / (name + '.err')).open('wb') as err:
        result = subprocess.run([str(OWN / 'target/debug/migrate')], env=env, stdout=out, stderr=err)
    (EVIDENCE / (name + '.rc')).write_text(str(result.returncode))
    assert (result.returncode == 0) == success, name
    print(name, 'PASS', flush=True)


def digests(db):
    return sql(db, """
SELECT 'access',md5(string_agg((to_jsonb(m)-ARRAY['resource_member_id','display_name','email','member_kind','linked_at','created_at','updated_at'])::text,'' ORDER BY member_id)) FROM project_members m WHERE member_id=ANY(ARRAY[""" + original_ids + """]::uuid[]);
SELECT 'tasks',md5(string_agg((to_jsonb(t)-'assignee_id'-'assignee_resource_member_id')::text,'' ORDER BY task_id)) FROM tasks t;
SELECT 'plans',md5(string_agg(to_jsonb(t)::text,'' ORDER BY plan_id)) FROM plans t;
""" + '\n'.join("SELECT '" + table + "',md5(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text)) FROM " + table + ' t;' for table in ['member_capacity_settings','member_capacity_overrides','member_days_off','resource_groups','resource_group_members','resource_member_classifications','recurring_commitments']) + "\nSELECT 'resources',md5(string_agg(concat_ws('|',resource_member_id,project_id,display_name,member_kind),'' ORDER BY resource_member_id)) FROM resource_members WHERE resource_member_id=ANY(ARRAY[" + resource_ids + ']::uuid[]);')


# Actual executable built from current source, never stock migration ordering/baseline.
env = os.environ.copy()
env['DATABASE_URL'] = 'postgresql://gm_tester:' + env['PGPASSWORD'] + '@127.0.0.1:55435/gm_rehearsal'
with (EVIDENCE / 'migrate-build.out').open('wb') as out, (EVIDENCE / 'migrate-build.err').open('wb') as err:
    subprocess.run(['cargo', 'build', '--locked', '--offline', '--bin', 'migrate'], cwd=SOURCE, env=env, stdout=out, stderr=err, check=True)
upgrade = 'gm_auth_upgrade_20260907'
bad = 'gm_auth_bad_edge_20260907'
restore(upgrade)
original_ids = ','.join("'" + x + "'" for x in sql(upgrade, 'SELECT member_id FROM project_members ORDER BY member_id').decode().splitlines())
resource_ids = ','.join("'" + x + "'" for x in sql(upgrade, 'SELECT resource_member_id FROM resource_members ORDER BY resource_member_id').decode().splitlines())
before = digests(upgrade)
(EVIDENCE / 'upgrade-before.txt').write_bytes(before)
runner(upgrade, 'runner-upgrade')
after = digests(upgrade)
(EVIDENCE / 'upgrade-after.txt').write_bytes(after)
assert before == after, 'original IDs/access metadata/config/task/plan preservation'
(EVIDENCE / 'populated-assertions.out').write_bytes(sql(upgrade, (ROOT / 'artifact-verification/populated-assertions.sql').read_text()))
print('ALL original IDs/access metadata/config/tasks/plans preservation PASS', flush=True)
runner(bad, 'runner-fresh-bootstrap')
backup(bad, 'fresh-bootstrap-before-trigger-probes')
for name in ['bootstrap-trigger-tests.sql', 'bootstrap-classification-tests.sql', 'bootstrap-self-consistency-tests.sql']:
    fixture = ROOT / 'artifact-verification/reused-tests' / name
    (EVIDENCE / (name + '.out')).write_bytes(sql(bad, fixture.read_text()))
print('Fresh valid/13 invalid classification/config/account-delete probes PASS', flush=True)
for kind in ['cross-project', 'member-classifier']:
    restore(bad, reset=True)
    if kind == 'cross-project':
        sql(bad, "INSERT INTO resource_members(resource_member_id,project_id,display_name,member_kind) VALUES ('00000000-0000-4000-8000-000000009999','00000000-0000-4000-8000-000000000202','foreign classifier','COMPANY'); INSERT INTO resource_member_classifications(resource_member_id,classified_by_resource_member_id) VALUES ('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000009999');")
    else:
        sql(bad, "INSERT INTO resource_member_classifications(resource_member_id,classified_by_resource_member_id) VALUES ('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000402');")
    backup(bad, kind + '-pre-migration')
    check = "SELECT 'history',md5(string_agg(to_jsonb(m)::text,'' ORDER BY version)) FROM _sqlx_migrations m; SELECT 'relations',string_agg(relname||':'||relkind::text,',' ORDER BY relname) FROM pg_class WHERE relname IN ('project_members','resource_members'); SELECT 'data',md5(string_agg(to_jsonb(m)::text,'' ORDER BY resource_member_id)) FROM resource_members m; SELECT 'edges',md5(string_agg(to_jsonb(m)::text,'' ORDER BY resource_member_id,classified_by_resource_member_id)) FROM resource_member_classifications m;"
    pre = sql(bad, check) + digests(bad)
    (EVIDENCE / (kind + '-before.txt')).write_bytes(pre)
    runner(bad, 'runner-bad-' + kind, success=False)
    post = sql(bad, check) + digests(bad)
    (EVIDENCE / (kind + '-after.txt')).write_bytes(post)
    assert pre == post, kind + ' rollback preservation/history'
    assert b'non-MEMBER scheduling configuration' in (EVIDENCE / ('runner-bad-' + kind + '.err')).read_bytes()
    print(kind, 'negative existing-edge rollback PASS', flush=True)
print('MIGRATION REQUALIFICATION COMPLETE', flush=True)
