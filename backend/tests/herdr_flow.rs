//! herdr-260905 end-to-end GraphQL resolver round-trips against an ISOLATED
//! local PostgreSQL (requirement gate D). Never touches existing DBs or
//! credentials: connects ONLY to the `TEST_DATABASE_URL` you pass explicitly.
//! Reproducible run with an ephemeral cluster (no credentials, trust auth,
//! unix socket only):
//!   TMP=$(mktemp -d); initdb -D $TMP/data -U pgtest --auth=trust
//!   pg_ctl -D $TMP/data -o "-p 55499 -k $TMP -c listen_addresses=''" -l $TMP/log start
//!   psql -h $TMP -p 55499 -U pgtest -d postgres -c "CREATE DATABASE herdr_flow_test;"
//!   TEST_DATABASE_URL="host=$TMP port=55499 user=pgtest dbname=herdr_flow_test" \
//!     cargo test --test herdr_flow -- --nocapture
//!   pg_ctl -D $TMP/data stop -m fast; rm -rf $TMP
//! Tests are SKIPPED (not failed) when TEST_DATABASE_URL is unset.

use async_graphql::{EmptySubscription, Request, Schema};
use chrono::{Duration, Utc};
use std::collections::HashSet;
use task_scheduler_backend::auth::types::Claims;
use task_scheduler_backend::config::Config;
use task_scheduler_backend::graphql::context::Context as GraphQLContext;
use task_scheduler_backend::graphql::dataloaders::{ProjectLoader, UserLoader};
use task_scheduler_backend::graphql::schema::{Mutation, Query};
use task_scheduler_backend::migration_runner;
use uuid::Uuid;

#[path = "support/authority_regressions.rs"]
mod authority_regressions;

async fn api_test_pool(url: &str) -> sqlx::PgPool {
    let pool = sqlx::PgPool::connect(url)
        .await
        .expect("connect TEST_DATABASE_URL");
    let database: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .expect("read isolated test database name");
    assert_eq!(
        database, "gm_auth_verify_20260907",
        "herdr_flow may reset only the BACKEND-AUTHORITY-FIX-owned database"
    );
    pool
}

fn gql_ctx(pool: sqlx::PgPool, user: Option<Uuid>) -> GraphQLContext {
    let auth = user.map(|u| {
        Claims::new(
            u.to_string(),
            format!("{u}@test.local"),
            "T".into(),
            Duration::hours(1),
        )
    });
    GraphQLContext::new(
        pool.clone(),
        auth,
        ProjectLoader::new(pool.clone()),
        UserLoader::new(pool.clone()),
        Config::default(),
    )
}

async fn exec(pool: &sqlx::PgPool, user: Option<Uuid>, doc: String) -> async_graphql::Response {
    let schema = Schema::build(Query::default(), Mutation::default(), EmptySubscription).finish();
    schema
        .execute(Request::new(doc).data(gql_ctx(pool.clone(), user)))
        .await
}

fn jstr(v: &serde_json::Value, path: &[&str]) -> String {
    let mut cur = v;
    for p in path {
        cur = &cur[p];
    }
    cur.as_str().unwrap_or_default().to_string()
}
fn jnum(v: &serde_json::Value, path: &[&str]) -> f64 {
    let mut cur = v;
    for p in path {
        cur = &cur[p];
    }
    cur.as_f64().unwrap_or(f64::NAN)
}

async fn exec_vars(
    pool: &sqlx::PgPool,
    user: Option<Uuid>,
    doc: String,
    vars: serde_json::Value,
) -> async_graphql::Response {
    let schema = Schema::build(Query::default(), Mutation::default(), EmptySubscription).finish();
    let mut req = Request::new(doc);
    if let Some(map) = vars.as_object() {
        let mut variables = async_graphql::Variables::default();
        for (k, v) in map {
            variables.insert(
                async_graphql::Name::new(k),
                async_graphql::Value::from_json(v.clone()).expect("variable value"),
            );
        }
        req = req.variables(variables);
    }
    schema.execute(req.data(gql_ctx(pool.clone(), user))).await
}

#[tokio::test]
async fn herdr_flow_end_to_end() {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must name the API-TEST isolated database");
    let pool = api_test_pool(&url).await;
    // The pool helper positively checks the API-TEST-owned DB name before
    // this destructive reset; reruns then remain deterministic.
    sqlx::query("DROP SCHEMA public CASCADE")
        .execute(&pool)
        .await
        .expect("drop schema (isolated test DB only)");
    sqlx::query("CREATE SCHEMA public")
        .execute(&pool)
        .await
        .expect("create schema");
    let outcome = migration_runner::run(&pool)
        .await
        .expect("migrations must apply on the isolated DB");
    eprintln!("migrations applied: {outcome:?}");

    // ── seed: users, two projects, tasks ───────────────────────────────────
    let owner = Uuid::new_v4();
    let outsider = Uuid::new_v4();
    for (u, email, name) in [
        (owner, "owner@test.local", "owner"),
        (outsider, "out@test.local", "out"),
    ] {
        sqlx::query("INSERT INTO users (user_id, email, username) VALUES ($1,$2,$3)")
            .bind(u)
            .bind(email)
            .bind(name)
            .execute(&pool)
            .await
            .unwrap();
    }
    let p1 = Uuid::new_v4();
    let p2 = Uuid::new_v4();
    for (p, name, o) in [(p1, "P1", owner), (p2, "P2", outsider)] {
        sqlx::query("INSERT INTO projects (project_id, name, owner_id) VALUES ($1,$2,$3)")
            .bind(p)
            .bind(name)
            .bind(o)
            .execute(&pool)
            .await
            .unwrap();
    }
    let t1 = Uuid::new_v4();
    let deleted_task = Uuid::new_v4();
    for (t, title, del) in [(t1, "T1", false), (deleted_task, "Gone", true)] {
        sqlx::query("INSERT INTO tasks (task_id, project_id, title, created_by, status, priority, is_deleted) VALUES ($1,$2,$3,$4,'TODO','MEDIUM',$5)")
            .bind(t).bind(p1).bind(title).bind(owner).bind(del).execute(&pool).await.unwrap();
    }

    // ── R2: placeholder without email ──────────────────────────────────────
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"NoEmail\" }}) {{ resource_member_id user_id }} }}"
    )).await;
    assert!(r.errors.is_empty(), "placeholder create: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let placeholder = jstr(&v, &["create_resource_member", "resource_member_id"]);
    assert_eq!(
        v["create_resource_member"]["user_id"],
        serde_json::Value::Null,
        "placeholder has NO user"
    );

    // assignment identity: tasks reference the resource member id directly
    // (column assignee_resource_member where supported; identity = stable id)
    let link_q = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM information_schema.columns WHERE table_name='tasks' AND column_name='assignee_resource_member'")
        .fetch_one(&pool).await.unwrap();
    if link_q > 0 {
        sqlx::query("UPDATE tasks SET assignee_resource_member=$1 WHERE task_id=$2")
            .bind(Uuid::parse_str(&placeholder).unwrap())
            .bind(t1)
            .execute(&pool)
            .await
            .unwrap();
    } else {
        eprintln!("note: tasks.assignee_resource_member absent — assignment identity documented via stable resource_member_id (R2 link keeps the id)");
    }

    // ── R2: link existing user; assignments retained (same member id) ──────
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ link_resource_member_user(resource_member_id: \"{placeholder}\", user_id: \"{outsider}\") {{ resource_member_id user_id linked_at }} }}"
    )).await;
    assert!(r.errors.is_empty(), "link: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        jstr(&v, &["link_resource_member_user", "user_id"]),
        outsider.to_string()
    );
    assert_eq!(
        jstr(&v, &["link_resource_member_user", "resource_member_id"]),
        placeholder,
        "member id STABLE across link → assignments retained"
    );
    assert!(!v["link_resource_member_user"]["linked_at"].is_null());

    // duplicate link forbidden
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ a: create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"Dup\", email: \"out@test.local\" }}) {{ resource_member_id }} }}"
    )).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let dup = jstr(&v, &["a", "resource_member_id"]);
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ link_resource_member_user(resource_member_id: \"{dup}\", user_id: \"{outsider}\") {{ resource_member_id }} }}"
    )).await;
    assert!(!r.errors.is_empty(), "duplicate link must be rejected");

    // cross-project unauthorized write
    let r = exec(&pool, Some(outsider), format!(
        "mutation {{ create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"Hack\" }}) {{ resource_member_id }} }}"
    )).await;
    assert!(
        !r.errors.is_empty(),
        "non-member must NOT write members in p1"
    );

    // ── R3: invalid capacity rejected; valid persists ──────────────────────
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ set_member_capacity(input: {{ resource_member_id: \"{placeholder}\", weekday_hours: 30.0, weekend_hours: 0.0 }}) {{ weekday_hours }} }}"
    )).await;
    assert!(!r.errors.is_empty(), "30h weekday must be rejected");
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ set_member_capacity(input: {{ resource_member_id: \"{placeholder}\", weekday_hours: 8.0, weekend_hours: 0.0 }}) {{ weekday_hours weekend_hours }} }}"
    )).await;
    assert!(r.errors.is_empty(), "valid capacity: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(jnum(&v, &["set_member_capacity", "weekday_hours"]), 8.0);

    // ── R4: group with mixed linked/unlinked; idempotent add; expansion ────
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_resource_group(project_id: \"{p1}\", name: \"Team A\") {{ id member_ids }} }}"
    )).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let group = jstr(&v, &["create_resource_group", "id"]);
    // second placeholder WITHOUT user (unlinked) to mix
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"Ghost\" }}) {{ resource_member_id }} }}"
    )).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let ghost = jstr(&v, &["create_resource_member", "resource_member_id"]);

    let add = |members: String| {
        format!("mutation {{ add_resource_group_members(group_id: \"{group}\", member_ids: [{members}]) }}")
    };
    let r1 = exec(
        &pool,
        Some(owner),
        add(format!("\"{placeholder}\", \"{ghost}\"")),
    )
    .await;
    assert!(r1.errors.is_empty(), "add members: {:?}", r1.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r1.data).unwrap()).unwrap();
    assert_eq!(jnum(&v, &["add_resource_group_members"]), 2.0);
    let r2 = exec(
        &pool,
        Some(owner),
        add(format!("\"{placeholder}\", \"{ghost}\"")),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r2.data).unwrap()).unwrap();
    assert_eq!(
        jnum(&v, &["add_resource_group_members"]),
        2.0,
        "duplicate add idempotent (size stays 2)"
    );

    let r = exec(
        &pool,
        Some(owner),
        format!("mutation {{ add_project_members_by_group(group_id: \"{group}\") }}",),
    )
    .await;
    assert!(r.errors.is_empty(), "expand: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        jnum(&v, &["add_project_members_by_group"]),
        1.0,
        "ONLY the LINKED member's user is added; unlinked skipped"
    );
    // membership visible in schedule-affecting project_members
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM project_members WHERE project_id=$1 AND user_id=$2",
    )
    .bind(p1)
    .bind(outsider)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(n, 1, "group expansion created exactly one membership row");

    // ── R6: recurring commitment persists ──────────────────────────────────
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_recurring_commitment(input: {{ project_id: \"{p1}\", title: \"Standup\", scope: \"PROJECT\", frequency: WEEKLY, weekday: 1, start_date: \"2026-09-07\", start_hour: 9, duration_hours: 1.0 }}) {{ title frequency }} }}"
    )).await;
    assert!(r.errors.is_empty(), "commitment: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        jstr(&v, &["create_recurring_commitment", "title"]),
        "Standup"
    );

    // ── R8: timesheet upsert / partial / clear / ownership / cross-project ─
    let batch = |entries: String| {
        format!("mutation {{ save_timesheet_batch(input: {{ project_id: \"{p1}\", entries: [{entries}] }}) {{ saved errors {{ row message }} }} }}")
    };
    let e = |task: Uuid, hours: f64| {
        format!("{{ task_id: \"{task}\", work_date: \"2026-09-07\", hours: {hours} }}")
    };
    let r1 = exec(&pool, Some(owner), batch(e(t1, 4.0))).await;
    assert!(r1.errors.is_empty());
    let r2 = exec(&pool, Some(owner), batch(e(t1, 6.0))).await; // idempotent retry, no duplicates
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r2.data).unwrap()).unwrap();
    assert_eq!(jnum(&v, &["save_timesheet_batch", "saved"]), 1.0);

    let q = format!("query {{ my_timesheet_entries(project_id: \"{p1}\", from: \"2026-09-07\", to: \"2026-09-07\") {{ user_id task_id hours }} }}");
    let r = exec(&pool, Some(owner), q).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let rows = v["my_timesheet_entries"].as_array().unwrap();
    assert_eq!(rows.len(), 1, "upsert twice → exactly ONE row");
    assert_eq!(
        rows[0]["hours"].as_f64().unwrap(),
        6.0,
        "overwrite last-wins"
    );
    assert_eq!(
        rows[0]["user_id"].as_str().unwrap(),
        owner.to_string(),
        "caller-only ownership"
    );
    // outsider (member via group, read gate) sees ONLY their own (empty) rows
    let r = exec(&pool, Some(outsider), format!("query {{ my_timesheet_entries(project_id: \"{p1}\", from: \"2026-09-07\", to: \"2026-09-07\") {{ user_id }} }}")).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        v["my_timesheet_entries"].as_array().unwrap().len(),
        0,
        "ownership separation: other member's rows invisible"
    );

    // mixed valid + invalid rows → partial success with accurate counts
    let unknown = Uuid::new_v4();
    let r = exec(
        &pool,
        Some(owner),
        batch(format!(
            "{}, {}, {}, {}",
            e(t1, 2.0),
            e(t1, 99.0),
            e(unknown, 1.0),
            e(deleted_task, 1.0)
        )),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        jnum(&v, &["save_timesheet_batch", "saved"]),
        1.0,
        "valid row saved"
    );
    let errs = v["save_timesheet_batch"]["errors"].as_array().unwrap();
    assert_eq!(
        errs.len(),
        3,
        "99h + unknown task + deleted task rejected: {errs:?}"
    );

    // clear-0 removes the entry (correction semantics)
    let r = exec(&pool, Some(owner), batch(e(t1, 0.0))).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert!(
        v["save_timesheet_batch"]["errors"]
            .as_array()
            .unwrap()
            .is_empty(),
        "clear must not error"
    );
    let r = exec(&pool, Some(owner), format!("query {{ my_timesheet_entries(project_id: \"{p1}\", from: \"2026-09-07\", to: \"2026-09-07\") {{ task_id }} }}")).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        v["my_timesheet_entries"].as_array().unwrap().len(),
        0,
        "hours=0 cleared the mistaken log"
    );

    // cross-project task rejected (p2 task in a p1 batch)
    let p2_task = Uuid::new_v4();
    sqlx::query("INSERT INTO tasks (task_id, project_id, title, created_by, status, priority) VALUES ($1,$2,'X',$3,'TODO','MEDIUM')")
        .bind(p2_task).bind(p2).bind(outsider).execute(&pool).await.unwrap();
    let r = exec(&pool, Some(owner), batch(e(p2_task, 1.0))).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert!(
        !v["save_timesheet_batch"]["errors"]
            .as_array()
            .unwrap()
            .is_empty(),
        "cross-project task rejected"
    );

    // ── herdr-260906 R5: placeholder task assignment via API ───────────────
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ pm: create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"PreLink\" }}) {{ resource_member_id }} }}"
    )).await;
    assert!(r.errors.is_empty(), "placeholder2 create: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let placeholder2 = jstr(&v, &["pm", "resource_member_id"]);

    // task assigned to the UNLINKED placeholder via create_task
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_task(input: {{ project_id: \"{p1}\", title: \"PlaceholderAssigned\", status: TODO, priority: MEDIUM, priority_order: 1, assignee_resource_member_id: \"{placeholder2}\" }}) {{ task_id assignee_resource_member_id }} }}"
    )).await;
    assert!(
        r.errors.is_empty(),
        "create_task w/ placeholder assignee: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let ptask = jstr(&v, &["create_task", "task_id"]);
    assert_eq!(
        jstr(&v, &["create_task", "assignee_resource_member_id"]),
        placeholder2,
        "task carries placeholder assignment"
    );

    // cross-project member rejected (member of p2 assigned in p1)
    let r = exec(&pool, Some(outsider), format!(
        "mutation {{ pm2: create_resource_member(input: {{ project_id: \"{p2}\", display_name: \"OtherProject\" }}) {{ resource_member_id }} }}"
    )).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let other_member = jstr(&v, &["pm2", "resource_member_id"]);
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_task(input: {{ project_id: \"{p1}\", title: \"Bad\", status: TODO, priority: MEDIUM, priority_order: 2, assignee_resource_member_id: \"{other_member}\" }}) {{ task_id }} }}"
    )).await;
    assert!(
        !r.errors.is_empty(),
        "cross-project placeholder assignment must be rejected"
    );

    // linking the placeholder keeps the assignment identity (same id)
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ link_resource_member_user(resource_member_id: \"{placeholder2}\", user_id: \"{owner}\") {{ resource_member_id }} }}"
    )).await;
    assert!(r.errors.is_empty(), "link placeholder2: {:?}", r.errors);
    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ task(task_id: \"{ptask}\") {{ task_id assignee_resource_member_id }} }}"),
    )
    .await;
    assert!(r.errors.is_empty(), "task query: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        jstr(&v, &["task", "assignee_resource_member_id"]),
        placeholder2,
        "assignment identity STABLE across user link"
    );

    // read-authz probe: a user with NO relation to p1 (outsider was ADDED to
    // p1 by the R4 group-expansion flow above, so it legitimately reads p1).
    let stranger = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (user_id, email, username) VALUES ($1,'stranger@test.local','stranger')",
    )
    .bind(stranger)
    .execute(&pool)
    .await
    .unwrap();

    // ── herdr-260906 plan lifecycle ─────────────────────────────────────────
    let snap = format!(
        "{{ version: 2, tasks: [{{ taskId: \"{t1}\", startDate: \"2026-09-06\", endDate: \"2026-09-08\", hoursPerDay: {{ \"2026-09-06\": 8, \"2026-09-07\": 8, \"2026-09-08\": 4 }}, assigneeResourceMemberId: \"{placeholder2}\", priorityOrder: 1 }}], meta: {{ horizonDays: 365 }} }}"
    );
    // snapshot payloads are passed as VARIABLES (date keys like
    // "2026-09-06" are not valid GraphQL field names in literals).
    let snap_json = serde_json::json!({
        "version": 2,
        "tasks": [{
            "taskId": t1.to_string(),
            "startDate": "2026-09-06",
            "endDate": "2026-09-08",
            "hoursPerDay": { "2026-09-06": 8, "2026-09-07": 8, "2026-09-08": 4 },
            "assigneeResourceMemberId": placeholder2,
            "priorityOrder": 1
        }],
        "meta": { "horizonDays": 365 }
    });
    let snap2_json = serde_json::json!({
        "version": 2,
        "tasks": [{
            "taskId": t1.to_string(),
            "startDate": "2026-09-09",
            "endDate": "2026-09-10",
            "hoursPerDay": { "2026-09-09": 6 },
            "assigneeResourceMemberId": placeholder2,
            "priorityOrder": 1
        }],
        "meta": { "recalculated": true }
    });
    let snap3_json = serde_json::json!({
        "version": 2,
        "tasks": [{
            "taskId": t1.to_string(),
            "startDate": "2026-09-11",
            "endDate": "2026-09-11",
            "hoursPerDay": { "2026-09-11": 2 },
            "priorityOrder": 1
        }],
        "meta": { "recalculated": true, "note": "same-rev" }
    });
    let save_m = |name: &str, mode: &str, plan: Option<&str>| {
        let plan_arg = match plan {
            Some(id) => format!(", plan_id: \"{id}\""),
            None => String::new(),
        };
        format!(
            "mutation SavePlan($snap: JSON!) {{ save_plan_snapshot(input: {{ project_id: \"{p1}\", name: \"{name}\", revision_mode: {mode}{plan_arg}, snapshot: $snap }}) {{ plan_id revision is_active stale stale_reasons parent_plan_id plan_data }} }}"
        )
    };
    let save_exec = |name: &str, mode: &str, plan: Option<&str>, snap: &serde_json::Value| {
        (
            save_m(name, mode, plan),
            serde_json::json!({ "snap": snap }),
        )
    };

    // create: revision 1, active, fresh (not stale)
    let (doc, vars) = save_exec("Baseline", "NEW_REVISION", None, &snap_json);
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(
        r.errors.is_empty(),
        "save_plan_snapshot create: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let plan1 = jstr(&v, &["save_plan_snapshot", "plan_id"]);
    assert_eq!(jnum(&v, &["save_plan_snapshot", "revision"]), 1.0);
    assert!(v["save_plan_snapshot"]["is_active"].as_bool().unwrap());
    assert!(
        !v["save_plan_snapshot"]["stale"].as_bool().unwrap(),
        "fresh save is NOT stale"
    );
    let pd1 = v["save_plan_snapshot"]["plan_data"].clone();
    assert_eq!(
        pd1["tasks"][0]["hoursPerDay"]["2026-09-08"]
            .as_f64()
            .unwrap(),
        4.0,
        "per-day hours round-trip"
    );

    // write authz: outsider cannot save a plan for p1
    let (doc, vars) = save_exec("Evil", "NEW_REVISION", None, &snap_json);
    let r = exec_vars(&pool, Some(outsider), doc, vars).await;
    assert!(!r.errors.is_empty(), "outsider plan save must be rejected");

    // config change AFTER save → stale, but snapshot UNCHANGED (no destructive overwrite)
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ add_day_off(input: {{ project_id: \"{p1}\", scope: \"PROJECT\", start_date: \"2026-09-07\", end_date: \"2026-09-07\", reason: \"holiday\" }}) {{ id }} }}"
    )).await;
    assert!(r.errors.is_empty(), "add_day_off: {:?}", r.errors);
    let r = exec(&pool, Some(owner), format!("query {{ saved_plan(plan_id: \"{plan1}\") {{ stale stale_reasons plan_data revision }} }}")).await;
    assert!(r.errors.is_empty(), "saved_plan load: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert!(
        v["saved_plan"]["stale"].as_bool().unwrap(),
        "config change marks plan stale"
    );
    assert!(
        v["saved_plan"]["stale_reasons"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r.as_str().unwrap_or("").contains("days_off")),
        "stale reason names the config category: {:?}",
        v["saved_plan"]["stale_reasons"]
    );
    assert_eq!(
        v["saved_plan"]["plan_data"]["tasks"][0]["hoursPerDay"]["2026-09-08"]
            .as_f64()
            .unwrap(),
        4.0,
        "snapshot bytes UNCHANGED before explicit recalc (no destructive overwrite)"
    );

    // recalc metadata: saved-plan task ids + staleness for client draft rebuild
    let r = exec(&pool, Some(owner), format!("query {{ plan_recalc_metadata(plan_id: \"{plan1}\") {{ task_ids stale current_config_fingerprint revision }} }}")).await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert!(r.errors.is_empty(), "recalc metadata: {:?}", r.errors);
    assert_eq!(
        v["plan_recalc_metadata"]["task_ids"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        v["plan_recalc_metadata"]["task_ids"][0].as_str().unwrap(),
        t1.to_string()
    );
    assert!(v["plan_recalc_metadata"]["stale"].as_bool().unwrap());
    assert!(!v["plan_recalc_metadata"]["current_config_fingerprint"]
        .as_str()
        .unwrap()
        .is_empty());

    // NEW_REVISION save: appended row, old row retained+deactivated, non-destructive
    let snap2 = format!(
        "{{ version: 2, tasks: [{{ taskId: \"{t1}\", startDate: \"2026-09-09\", endDate: \"2026-09-10\", hoursPerDay: {{ \"2026-09-09\": 6 }}, assigneeResourceMemberId: \"{placeholder2}\", priorityOrder: 1 }}], meta: {{ recalculated: true }} }}"
    );
    let (doc, vars) = save_exec("Baseline", "NEW_REVISION", Some(&plan1), &snap2_json);
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(r.errors.is_empty(), "NEW_REVISION save: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let plan2 = jstr(&v, &["save_plan_snapshot", "plan_id"]);
    assert_eq!(
        jnum(&v, &["save_plan_snapshot", "revision"]),
        2.0,
        "revision appended"
    );
    assert_eq!(
        jstr(&v, &["save_plan_snapshot", "parent_plan_id"]),
        plan1,
        "revision chain recorded"
    );
    assert_ne!(plan1, plan2, "NEW_REVISION is a NEW row");

    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ saved_plans(project_id: \"{p1}\") {{ plan_id revision is_active }} }}"),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let list = v["saved_plans"].as_array().unwrap();
    assert_eq!(list.len(), 2, "old revision retained: {list:?}");
    let old = list
        .iter()
        .find(|p| p["plan_id"].as_str().unwrap() == plan1)
        .unwrap();
    let new = list
        .iter()
        .find(|p| p["plan_id"].as_str().unwrap() == plan2)
        .unwrap();
    assert!(
        !old["is_active"].as_bool().unwrap() && new["is_active"].as_bool().unwrap(),
        "active pointer moved; old snapshot kept"
    );

    // SAME_REVISION: explicit in-place overwrite of plan2 only
    let snap3 = format!(
        "{{ version: 2, tasks: [{{ taskId: \"{t1}\", startDate: \"2026-09-11\", endDate: \"2026-09-11\", hoursPerDay: {{ \"2026-09-11\": 2 }}, priorityOrder: 1 }}], meta: {{ recalculated: true, note: \"same-rev\" }} }}"
    );
    let (doc, vars) = save_exec("Baseline", "SAME_REVISION", Some(&plan2), &snap3_json);
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(r.errors.is_empty(), "SAME_REVISION save: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        jstr(&v, &["save_plan_snapshot", "plan_id"]),
        plan2,
        "SAME_REVISION keeps the row"
    );
    assert_eq!(jnum(&v, &["save_plan_snapshot", "revision"]), 2.0);
    assert_eq!(
        v["save_plan_snapshot"]["plan_data"]["tasks"][0]["hoursPerDay"]["2026-09-11"]
            .as_f64()
            .unwrap(),
        2.0,
        "in-place snapshot replaced"
    );
    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ saved_plans(project_id: \"{p1}\") {{ plan_id }} }}"),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert_eq!(
        v["saved_plans"].as_array().unwrap().len(),
        2,
        "SAME_REVISION adds no row"
    );

    // invalid snapshot rejected (empty tasks)
    let (doc, vars) = save_exec(
        "Bad",
        "NEW_REVISION",
        None,
        &serde_json::json!({"version":2,"tasks":[]}),
    );
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(!r.errors.is_empty(), "empty snapshot must be rejected");
    // read authz: outsider cannot list p1 plans
    let r = exec(
        &pool,
        Some(stranger),
        format!("query {{ saved_plans(project_id: \"{p1}\") {{ plan_id }} }}"),
    )
    .await;
    assert!(
        !r.errors.is_empty(),
        "stranger (non-member) plan list must be rejected"
    );

    // ── rework P2-1: fingerprint detects IN-PLACE UPDATEs (trigger-bumped
    //    updated_at) — save fresh, UPDATE a day off row, assert stale again.
    let (doc, vars) = save_exec("AfterDayOff", "NEW_REVISION", Some(&plan2), &snap3_json);
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(
        r.errors.is_empty(),
        "re-save after day-off create: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let plan3 = jstr(&v, &["save_plan_snapshot", "plan_id"]);
    assert!(
        !v["save_plan_snapshot"]["stale"].as_bool().unwrap(),
        "fresh save not stale"
    );
    // IN-PLACE update of the day-off row (not insert!) — trigger must bump updated_at
    sqlx::query("UPDATE member_days_off SET end_date = '2026-09-09', reason = 'extended' WHERE project_id = $1")
        .bind(p1).execute(&pool).await.unwrap();
    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ saved_plan(plan_id: \"{plan3}\") {{ stale stale_reasons }} }}"),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    assert!(
        v["saved_plan"]["stale"].as_bool().unwrap(),
        "IN-PLACE day-off UPDATE must mark the plan stale (P2-1)"
    );
    assert!(v["saved_plan"]["stale_reasons"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r.as_str().unwrap_or("").contains("days_off")));
    // group + commitment UPDATEs also flip staleness
    sqlx::query("UPDATE resource_groups SET name = name || ' v2' WHERE project_id = $1")
        .bind(p1)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE recurring_commitments SET duration_hours = duration_hours WHERE project_id = $1",
    )
    .bind(p1)
    .execute(&pool)
    .await
    .unwrap();
    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ saved_plan(plan_id: \"{plan3}\") {{ stale stale_reasons }} }}"),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let reasons: Vec<String> = v["saved_plan"]["stale_reasons"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r.as_str().unwrap_or("").to_string())
        .collect();
    assert!(
        reasons.iter().any(|r| r.contains("groups")),
        "group UPDATE detected: {reasons:?}"
    );
    assert!(
        reasons.iter().any(|r| r.contains("commitments")),
        "commitment UPDATE detected: {reasons:?}"
    );

    // ── rework P2-2: NEW_REVISION branched from an INACTIVE historical plan
    //    (plan1 is inactive since plan2/plan3 activated) must NOT dead-end in
    //    a unique-violation 500; it deactivates the CURRENT active and
    //    appends max+1.
    let (doc, vars) = save_exec("Restore from r1", "NEW_REVISION", Some(&plan1), &snap3_json);
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(
        r.errors.is_empty(),
        "branch from historical (inactive) revision: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let branched = jstr(&v, &["save_plan_snapshot", "plan_id"]);
    assert_eq!(
        jstr(&v, &["save_plan_snapshot", "parent_plan_id"]),
        plan1,
        "branch parent = historical revision"
    );
    assert_eq!(
        jnum(&v, &["save_plan_snapshot", "revision"]),
        4.0,
        "revision = project max+1 (1,2,3 → 4)"
    );
    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ saved_plans(project_id: \"{p1}\") {{ plan_id is_active }} }}"),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let list = v["saved_plans"].as_array().unwrap();
    let actives = list
        .iter()
        .filter(|p| p["is_active"].as_bool().unwrap())
        .count();
    assert_eq!(
        actives, 1,
        "exactly ONE active plan after branching (no unique violation)"
    );

    // ── rework P2-4: two CONCURRENT new-plan saves serialize (advisory
    //    lock); no raw 23505 500, exactly one active plan afterwards.
    let (doc_a, vars_a) = save_exec("Concurrent A", "NEW_REVISION", None, &snap3_json);
    let (doc_b, vars_b) = save_exec("Concurrent B", "NEW_REVISION", None, &snap3_json);
    let (ra, rb) = tokio::join!(
        exec_vars(&pool, Some(owner), doc_a, vars_a),
        exec_vars(&pool, Some(owner), doc_b, vars_b)
    );
    for (name, resp) in [("A", &ra), ("B", &rb)] {
        let raw_500 = resp.errors.iter().any(|e| {
            e.message.contains("error returned from database")
                || e.message.contains("duplicate key")
        });
        assert!(
            !raw_500,
            "concurrent save {name} must not surface a raw DB error: {:?}",
            resp.errors
        );
    }
    let r = exec(
        &pool,
        Some(owner),
        format!("query {{ saved_plans(project_id: \"{p1}\") {{ plan_id is_active }} }}"),
    )
    .await;
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let actives = v["saved_plans"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|p| p["is_active"].as_bool().unwrap())
        .count();
    assert_eq!(actives, 1, "exactly one active plan after concurrent saves");

    // ── rework P2-3/P3-2: negative bounds + project scope ──
    // name too long (>255)
    let long_name = "x".repeat(256);
    let (doc, vars) = (
        format!("mutation SavePlan($snap: JSON!) {{ save_plan_snapshot(input: {{ project_id: \"{p1}\", name: \"{long_name}\", revision_mode: NEW_REVISION, snapshot: $snap }}) {{ plan_id }} }}"),
        serde_json::json!({ "snap": snap3_json }),
    );
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(!r.errors.is_empty(), "name >255 must be rejected");
    // hours > 24
    let bad_hours = serde_json::json!({"version":2,"tasks":[{"taskId": t1.to_string(),"startDate":"2026-09-06","endDate":"2026-09-06","hoursPerDay":{"2026-09-06": 30},"priorityOrder":1}],"meta":{}});
    let (doc, vars) = (
        format!("mutation SavePlan($snap: JSON!) {{ save_plan_snapshot(input: {{ project_id: \"{p1}\", name: \"BadHours\", revision_mode: NEW_REVISION, snapshot: $snap }}) {{ plan_id }} }}"),
        serde_json::json!({ "snap": bad_hours }),
    );
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(!r.errors.is_empty(), "hours/day > 24 must be rejected");
    // bad date shape
    let bad_date = serde_json::json!({"version":2,"tasks":[{"taskId": t1.to_string(),"startDate":"07/09/2026","endDate":"2026-09-06","hoursPerDay":{},"priorityOrder":1}],"meta":{}});
    let (doc, vars) = (
        format!("mutation SavePlan($snap: JSON!) {{ save_plan_snapshot(input: {{ project_id: \"{p1}\", name: \"BadDate\", revision_mode: NEW_REVISION, snapshot: $snap }}) {{ plan_id }} }}"),
        serde_json::json!({ "snap": bad_date }),
    );
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(!r.errors.is_empty(), "non yyyy-MM-dd date must be rejected");
    // task id from ANOTHER project (p2's task) in a p1 snapshot
    let cross_snap = serde_json::json!({"version":2,"tasks":[{"taskId": p2_task.to_string(),"startDate":"2026-09-06","endDate":"2026-09-06","hoursPerDay":{"2026-09-06": 4},"priorityOrder":1}],"meta":{}});
    let (doc, vars) = (
        format!("mutation SavePlan($snap: JSON!) {{ save_plan_snapshot(input: {{ project_id: \"{p1}\", name: \"CrossTask\", revision_mode: NEW_REVISION, snapshot: $snap }}) {{ plan_id }} }}"),
        serde_json::json!({ "snap": cross_snap }),
    );
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(
        !r.errors.is_empty(),
        "cross-project task id in snapshot must be rejected"
    );
    // non-UUID task id
    let junk_snap = serde_json::json!({"version":2,"tasks":[{"taskId": "not-a-uuid","startDate":"2026-09-06","endDate":"2026-09-06","hoursPerDay":{},"priorityOrder":1}],"meta":{}});
    let (doc, vars) = (
        format!("mutation SavePlan($snap: JSON!) {{ save_plan_snapshot(input: {{ project_id: \"{p1}\", name: \"Junk\", revision_mode: NEW_REVISION, snapshot: $snap }}) {{ plan_id }} }}"),
        serde_json::json!({ "snap": junk_snap }),
    );
    let r = exec_vars(&pool, Some(owner), doc, vars).await;
    assert!(!r.errors.is_empty(), "non-UUID task id must be rejected");

    // ── API-TEST: mounted selective clone / flat-tree persistence ──────────
    // Root has six direct children (three selected below) plus a nested
    // grandchild used independently for ancestor-closure/remap proof.
    let clone_root = Uuid::new_v4();
    let clone_due = "2026-10-05T12:00:00Z"
        .parse::<chrono::DateTime<Utc>>()
        .unwrap();
    let clone_start = "2026-09-20T12:00:00Z"
        .parse::<chrono::DateTime<Utc>>()
        .unwrap();
    sqlx::query(
        "INSERT INTO tasks (task_id, project_id, parent_task_id, title, description, \
         assignee_id, assignee_resource_member_id, priority_order, start_date, due_date, \
         actual_start_date, actual_end_date, effort, progress, created_by, status, priority, tags) \
         VALUES ($1,$2,$3,'api-clone-root','clone-description',$4,$5,10,$6,$7,$6,$7,7.5,0.8,$4,'DOING','HIGH',$8)",
    )
    .bind(clone_root).bind(p1).bind(t1).bind(owner).bind(Uuid::parse_str(&placeholder2).unwrap())
    .bind(clone_start).bind(clone_due).bind(serde_json::json!(["clone-tag"]))
    .execute(&pool).await.unwrap();
    let mut clone_children = Vec::new();
    for (index, resource, user) in [
        (1, Some(Uuid::parse_str(&ghost).unwrap()), None),
        (
            2,
            Some(Uuid::parse_str(&placeholder2).unwrap()),
            Some(owner),
        ),
        (3, None, None),
        (4, None, None),
        (5, None, None),
        (6, None, None),
    ] {
        let child = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO tasks (task_id, project_id, parent_task_id, title, assignee_resource_member_id, assignee_id, \
             priority_order, effort, created_by, status, priority, tags) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,1.0,$8,'DOING','MEDIUM','[]')",
        )
        .bind(child).bind(p1).bind(clone_root).bind(format!("api-clone-c{index}"))
        .bind(resource).bind(user).bind(index * 10).bind(owner)
        .execute(&pool).await.unwrap();
        clone_children.push(child);
    }
    let clone_grandchild = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO tasks (task_id, project_id, parent_task_id, title, priority_order, effort, created_by, status, priority, tags) \
         VALUES ($1,$2,$3,'api-clone-grandchild',1,1.0,$4,'DOING','MEDIUM','[]')",
    )
    .bind(clone_grandchild).bind(p1).bind(clone_children[0]).bind(owner)
    .execute(&pool).await.unwrap();

    let active_before: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tasks WHERE project_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(p1)
    .fetch_one(&pool)
    .await
    .unwrap();
    let selected = [clone_children[0], clone_children[1], clone_children[2]];
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{}\",\"{}\",\"{}\"], quantity: 3 }}) {{ root_task_ids created_task_ids }} }}",
        selected[0], selected[1], selected[2],
    )).await;
    assert!(r.errors.is_empty(), "quantity clone: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let roots: Vec<Uuid> = v["clone_task_subtree"]["root_task_ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|id| Uuid::parse_str(id.as_str().unwrap()).unwrap())
        .collect();
    let created: Vec<Uuid> = v["clone_task_subtree"]["created_task_ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|id| Uuid::parse_str(id.as_str().unwrap()).unwrap())
        .collect();
    assert_eq!(roots.len(), 3, "one root per requested copy");
    assert_eq!(created.len(), 12, "three roots plus nine selected children");
    assert_eq!(
        created.iter().collect::<HashSet<_>>().len(),
        12,
        "every clone id is fresh"
    );
    assert!(created
        .iter()
        .all(|id| ![clone_root, selected[0], selected[1], selected[2]].contains(id)));
    let active_after: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tasks WHERE project_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(p1)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        active_after,
        active_before + 12,
        "persisted clone count after reload"
    );
    for copy in 0..3 {
        let offset = copy * 4;
        let parent: Option<Uuid> =
            sqlx::query_scalar("SELECT parent_task_id FROM tasks WHERE task_id = $1")
                .bind(created[offset])
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(parent, Some(t1), "clone root preserves source parent");
        for child_offset in 1..4 {
            let parent: Option<Uuid> =
                sqlx::query_scalar("SELECT parent_task_id FROM tasks WHERE task_id = $1")
                    .bind(created[offset + child_offset])
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(
                parent,
                Some(created[offset]),
                "copy {copy} child remaps only to its copy root"
            );
        }
        let unlinked: (Option<Uuid>, Option<Uuid>) = sqlx::query_as(
            "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1",
        )
        .bind(created[offset + 1])
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            unlinked,
            (Some(Uuid::parse_str(&ghost).unwrap()), None),
            "unlinked canonical assignment survives"
        );
        let linked: (Option<Uuid>, Option<Uuid>) = sqlx::query_as(
            "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1",
        )
        .bind(created[offset + 2])
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            linked,
            (Some(Uuid::parse_str(&placeholder2).unwrap()), Some(owner)),
            "linked canonical mirrors survive"
        );
    }
    let copied_root: (String, String, f64, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>, Option<String>, serde_json::Value) = sqlx::query_as(
        "SELECT status::text, priority::text, progress, start_date, actual_start_date, actual_end_date, due_date, description, tags FROM tasks WHERE task_id = $1",
    ).bind(roots[0]).fetch_one(&pool).await.unwrap();
    assert_eq!(copied_root.0, "TODO");
    assert_eq!(copied_root.1, "HIGH");
    assert_eq!(copied_root.2, 0.0);
    assert_eq!(copied_root.3, None);
    assert_eq!(copied_root.4, None);
    assert_eq!(copied_root.5, None);
    assert_eq!(copied_root.6, Some(clone_due));
    assert_eq!(copied_root.7.as_deref(), Some("clone-description"));
    assert_eq!(copied_root.8, serde_json::json!(["clone-tag"]));
    let unchecked_copies: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1 AND title IN ('api-clone-c4 (copy)', 'api-clone-c5 (copy)', 'api-clone-c6 (copy)')")
        .bind(p1).fetch_one(&pool).await.unwrap();
    assert_eq!(unchecked_copies, 0, "unchecked children are never inserted");

    // Nested selection maps each selected grandchild to its copied selected parent.
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{}\",\"{clone_grandchild}\"], quantity: 1 }}) {{ created_task_ids }} }}", selected[0],
    )).await;
    assert!(r.errors.is_empty(), "nested clone: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let nested: Vec<Uuid> = v["clone_task_subtree"]["created_task_ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|id| Uuid::parse_str(id.as_str().unwrap()).unwrap())
        .collect();
    assert_eq!(nested.len(), 3);
    assert_eq!(
        sqlx::query_scalar::<_, Option<Uuid>>(
            "SELECT parent_task_id FROM tasks WHERE task_id = $1"
        )
        .bind(nested[1])
        .fetch_one(&pool)
        .await
        .unwrap(),
        Some(nested[0])
    );
    assert_eq!(
        sqlx::query_scalar::<_, Option<Uuid>>(
            "SELECT parent_task_id FROM tasks WHERE task_id = $1"
        )
        .bind(nested[2])
        .fetch_one(&pool)
        .await
        .unwrap(),
        Some(nested[1])
    );
    // A child source remains below its original parent, not at project root.
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ clone_task_subtree(input: {{ source_task_id: \"{}\", selected_descendant_ids: [], quantity: 1 }}) {{ root_task_ids }} }}", selected[0],
    )).await;
    assert!(r.errors.is_empty(), "child source clone: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let child_copy = Uuid::parse_str(
        v["clone_task_subtree"]["root_task_ids"][0]
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, Option<Uuid>>(
            "SELECT parent_task_id FROM tasks WHERE task_id = $1"
        )
        .bind(child_copy)
        .fetch_one(&pool)
        .await
        .unwrap(),
        Some(clone_root)
    );

    // All malformed selections reject before insert; each persisted count stays fixed.
    for doc in [
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [], quantity: 0 }}) {{ created_task_ids }} }}"),
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{}\",\"{}\"], quantity: 1 }}) {{ created_task_ids }} }}", selected[0], selected[0]),
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{clone_root}\"], quantity: 1 }}) {{ created_task_ids }} }}"),
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{clone_grandchild}\"], quantity: 1 }}) {{ created_task_ids }} }}"),
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{deleted_task}\"], quantity: 1 }}) {{ created_task_ids }} }}"),
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{p2_task}\"], quantity: 1 }}) {{ created_task_ids }} }}"),
    ] {
        let before: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1").bind(p1).fetch_one(&pool).await.unwrap();
        let response = exec(&pool, Some(owner), doc).await;
        assert!(!response.errors.is_empty(), "invalid clone selection must error");
        let after: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1").bind(p1).fetch_one(&pool).await.unwrap();
        assert_eq!(after, before, "invalid clone selection wrote no rows");
    }

    // Corrupt/moved source links are conflicts, never a chance to clone an
    // orphan. These direct mutations are bounded to this isolated DB and are
    // restored before subsequent assertions.
    sqlx::query("UPDATE tasks SET parent_task_id = $1 WHERE task_id = $2")
        .bind(selected[0])
        .bind(clone_root)
        .execute(&pool)
        .await
        .unwrap();
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1")
        .bind(p1)
        .fetch_one(&pool)
        .await
        .unwrap();
    let cycle = exec(
        &pool,
        Some(owner),
        format!(
            "mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [], quantity: 1 }}) {{ created_task_ids }} }}"
        ),
    )
    .await;
    assert!(!cycle.errors.is_empty(), "corrupt source cycle must reject");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM tasks WHERE project_id = $1")
            .bind(p1)
            .fetch_one(&pool)
            .await
            .unwrap(),
        before,
        "cycle rejection wrote no rows"
    );
    sqlx::query("UPDATE tasks SET parent_task_id = $1 WHERE task_id = $2")
        .bind(t1)
        .bind(clone_root)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE tasks SET parent_task_id = $1 WHERE task_id = $2")
        .bind(t1)
        .bind(selected[0])
        .execute(&pool)
        .await
        .unwrap();
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1")
        .bind(p1)
        .fetch_one(&pool)
        .await
        .unwrap();
    let moved = exec(
        &pool,
        Some(owner),
        format!(
            "mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{}\"], quantity: 1 }}) {{ created_task_ids }} }}",
            selected[0]
        ),
    )
    .await;
    assert!(!moved.errors.is_empty(), "moved descendant must reject");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM tasks WHERE project_id = $1")
            .bind(p1)
            .fetch_one(&pool)
            .await
            .unwrap(),
        before,
        "moved descendant rejection wrote no rows"
    );
    sqlx::query("UPDATE tasks SET parent_task_id = $1 WHERE task_id = $2")
        .bind(clone_root)
        .bind(selected[0])
        .execute(&pool)
        .await
        .unwrap();

    // The second attempted task insert fails at the database boundary. The
    // mutation must roll back the already-attempted root insert too.
    sqlx::query("CREATE SEQUENCE api_test_clone_fail_seq")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("CREATE FUNCTION api_test_clone_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF nextval('api_test_clone_fail_seq') >= 2 THEN RAISE EXCEPTION 'api-test injected failure'; END IF; RETURN NEW; END; $$")
        .execute(&pool).await.unwrap();
    sqlx::query("CREATE TRIGGER api_test_clone_fail BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION api_test_clone_fail()")
        .execute(&pool).await.unwrap();
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1")
        .bind(p1)
        .fetch_one(&pool)
        .await
        .unwrap();
    let response = exec(&pool, Some(owner), format!(
        "mutation {{ clone_task_subtree(input: {{ source_task_id: \"{clone_root}\", selected_descendant_ids: [\"{}\"], quantity: 1 }}) {{ created_task_ids }} }}", selected[0],
    )).await;
    sqlx::query("DROP TRIGGER api_test_clone_fail ON tasks")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DROP FUNCTION api_test_clone_fail()")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DROP SEQUENCE api_test_clone_fail_seq")
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        !response.errors.is_empty(),
        "injected second-insert failure must surface"
    );
    let after: i64 = sqlx::query_scalar("SELECT count(*) FROM tasks WHERE project_id = $1")
        .bind(p1)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        after, before,
        "clone transaction rollback removes first attempted insert"
    );

    let tree_doc = format!("query {{ task_tree_rows(project_id: \"{p1}\") {{ task_id parent_task_id priority_order }} }}");
    let tree = exec(&pool, Some(owner), tree_doc.clone()).await;
    assert!(
        tree.errors.is_empty(),
        "owner reads flat tree: {:?}",
        tree.errors
    );
    let tree_again = exec(&pool, Some(owner), tree_doc).await;
    let tree_json: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&tree.data).unwrap()).unwrap();
    let tree_again_json: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&tree_again.data).unwrap()).unwrap();
    let rows = tree_json["task_tree_rows"].as_array().unwrap();
    let ids: Vec<&str> = rows
        .iter()
        .map(|row| row["task_id"].as_str().unwrap())
        .collect();
    let active_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tasks WHERE project_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(p1)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        ids.len() as i64,
        active_count,
        "flat tree returns every active depth once"
    );
    assert_eq!(ids.iter().collect::<HashSet<_>>().len(), ids.len());
    let deleted_id = deleted_task.to_string();
    assert!(!ids.contains(&deleted_id.as_str()));
    let positions: std::collections::HashMap<&str, usize> =
        ids.iter().enumerate().map(|(i, id)| (*id, i)).collect();
    for (index, row) in rows.iter().enumerate() {
        if let Some(parent) = row["parent_task_id"]
            .as_str()
            .filter(|parent| positions.contains_key(parent))
        {
            assert!(
                positions[parent] < index,
                "parent must precede child in flat tree"
            );
        }
    }
    assert_eq!(
        tree_json["task_tree_rows"], tree_again_json["task_tree_rows"],
        "flat tree ordering is deterministic"
    );
    assert!(!exec(
        &pool,
        None,
        format!("query {{ task_tree_rows(project_id: \"{p1}\") {{ task_id }} }}")
    )
    .await
    .errors
    .is_empty());
    assert!(!exec(
        &pool,
        Some(stranger),
        format!("query {{ task_tree_rows(project_id: \"{p1}\") {{ task_id }} }}")
    )
    .await
    .errors
    .is_empty());

    // ── API-TEST: canonical member/access/assignment persistence ──────────
    let email_user = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (user_id, email, username) VALUES ($1,'api-link@test.local','api-link')",
    )
    .bind(email_user)
    .execute(&pool)
    .await
    .unwrap();
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"API named only\" }}) {{ resource_member_id user_id display_name }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "named-only canonical create: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let named_only = jstr(&v, &["create_resource_member", "resource_member_id"]);
    assert_eq!(
        v["create_resource_member"]["user_id"],
        serde_json::Value::Null
    );
    assert_eq!(
        jstr(&v, &["create_resource_member", "display_name"]),
        "API named only"
    );

    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"API email link\" }}) {{ resource_member_id }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "email-link placeholder create: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let email_resource = jstr(&v, &["create_resource_member", "resource_member_id"]);
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_task(input: {{ project_id: \"{p1}\", title: \"API linked assignment\", status: TODO, priority: MEDIUM, priority_order: 90, assignee_resource_member_id: \"{email_resource}\" }}) {{ task_id }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "unlinked canonical assignment: {:?}",
        r.errors
    );
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let email_task = Uuid::parse_str(&jstr(&v, &["create_task", "task_id"])).unwrap();
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ link_resource_member_by_email(resource_member_id: \"{email_resource}\", email: \"api-link@test.local\") {{ resource_member_id user_id }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "link assigned placeholder by email: {:?}",
        r.errors
    );
    let pair: (Option<Uuid>, Option<Uuid>) = sqlx::query_as(
        "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1",
    )
    .bind(email_task)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        pair,
        (
            Some(Uuid::parse_str(&email_resource).unwrap()),
            Some(email_user)
        ),
        "email link synchronizes the assigned task mirror"
    );
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ update_task(input: {{ task_id: \"{email_task}\", title: \"API linked title edit\" }}) {{ task_id }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "title-only update after link: {:?}",
        r.errors
    );
    let pair_after_title: (Option<Uuid>, Option<Uuid>) = sqlx::query_as(
        "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1",
    )
    .bind(email_task)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        pair_after_title, pair,
        "omitted assignment preserves atomic canonical pair"
    );

    // A linked scheduling identity remains access-neutral until explicitly granted.
    assert!(!exec(
        &pool,
        Some(email_user),
        format!("query {{ task_tree_rows(project_id: \"{p1}\") {{ task_id }} }}")
    )
    .await
    .errors
    .is_empty());
    let omitted_role = exec(&pool, Some(owner), format!(
        "mutation {{ set_project_member_access(resource_member_id: \"{email_resource}\") {{ resource_member_id }} }}",
    )).await;
    assert!(
        !omitted_role.errors.is_empty(),
        "omitted role is not implicit revocation"
    );
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ set_project_member_access(resource_member_id: \"{email_resource}\", role: \"member\") {{ access_role }} }}",
    )).await;
    assert!(r.errors.is_empty(), "explicit access grant: {:?}", r.errors);
    assert!(exec(
        &pool,
        Some(email_user),
        format!("query {{ task_tree_rows(project_id: \"{p1}\") {{ task_id }} }}")
    )
    .await
    .errors
    .is_empty());
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ set_member_capacity(input: {{ resource_member_id: \"{email_resource}\", weekday_hours: 7.0, weekend_hours: 0.0 }}) {{ weekday_hours }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "canonical configuration persists: {:?}",
        r.errors
    );
    let r = exec(
        &pool,
        Some(owner),
        format!(
            "mutation {{ remove_project_member(project_id: \"{p1}\", user_id: \"{email_user}\") }}",
        ),
    )
    .await;
    assert!(r.errors.is_empty(), "legacy revoke: {:?}", r.errors);
    let retained: (Uuid, Option<Uuid>, Option<String>) = sqlx::query_as(
        "SELECT resource_member_id, user_id, role::text FROM project_members WHERE project_id = $1 AND resource_member_id = $2",
    ).bind(p1).bind(Uuid::parse_str(&email_resource).unwrap()).fetch_one(&pool).await.unwrap();
    assert_eq!(
        retained,
        (
            Uuid::parse_str(&email_resource).unwrap(),
            Some(email_user),
            None
        ),
        "revoke preserves canonical id/link while clearing only role"
    );
    assert!(!exec(
        &pool,
        Some(email_user),
        format!("query {{ task_tree_rows(project_id: \"{p1}\") {{ task_id }} }}")
    )
    .await
    .errors
    .is_empty());
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ add_project_member_by_email(project_id: \"{p1}\", email: \"api-link@test.local\", role: member) {{ user {{ user_id }} }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "legacy email grant reuses canonical row: {:?}",
        r.errors
    );
    let regranted_id: Uuid = sqlx::query_scalar(
        "SELECT resource_member_id FROM project_members WHERE project_id = $1 AND user_id = $2",
    )
    .bind(p1)
    .bind(email_user)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(regranted_id, Uuid::parse_str(&email_resource).unwrap());
    let capacity_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM member_capacity_settings WHERE resource_member_id = $1",
    )
    .bind(regranted_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        capacity_count, 1,
        "revoke/regrant retains resource configuration"
    );

    // Explicit assignment clear/set, mismatch/non-MEMBER/cross-project rejects,
    // and unrelated updates preserve both assignment and parent.
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ update_task(input: {{ task_id: \"{email_task}\", assignee_resource_member_id: null }}) {{ task_id }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "explicit assignment clear: {:?}",
        r.errors
    );
    assert_eq!(
        sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>)>(
            "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1"
        )
        .bind(email_task)
        .fetch_one(&pool)
        .await
        .unwrap(),
        (None, None)
    );
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ update_task(input: {{ task_id: \"{email_task}\", assignee_resource_member_id: \"{email_resource}\" }}) {{ task_id }} }}",
    )).await;
    assert!(
        r.errors.is_empty(),
        "explicit assignment set: {:?}",
        r.errors
    );
    assert_eq!(
        sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>)>(
            "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1"
        )
        .bind(email_task)
        .fetch_one(&pool)
        .await
        .unwrap(),
        pair
    );
    let mismatch = exec(&pool, Some(owner), format!(
        "mutation {{ update_task(input: {{ task_id: \"{email_task}\", assignee_resource_member_id: \"{email_resource}\", assignee_id: \"{owner}\" }}) {{ task_id }} }}",
    )).await;
    assert!(
        !mismatch.errors.is_empty(),
        "resource/user mismatch must reject"
    );
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_task(input: {{ project_id: \"{p1}\", parent_task_id: \"{clone_root}\", title: \"API preserve parent\", status: TODO, priority: MEDIUM, priority_order: 91, assignee_resource_member_id: \"{named_only}\" }}) {{ task_id }} }}",
    )).await;
    assert!(r.errors.is_empty(), "assigned child create: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let preserve_task = Uuid::parse_str(&jstr(&v, &["create_task", "task_id"])).unwrap();
    let r = exec(&pool, Some(owner), format!("mutation {{ update_task(input: {{ task_id: \"{preserve_task}\", title: \"API preserve parent title\" }}) {{ task_id }} }}")).await;
    assert!(r.errors.is_empty(), "unrelated update: {:?}", r.errors);
    assert_eq!(sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>, Option<Uuid>)>("SELECT parent_task_id, assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1").bind(preserve_task).fetch_one(&pool).await.unwrap(), (Some(clone_root), Some(Uuid::parse_str(&named_only).unwrap()), None));
    let r = exec(&pool, Some(owner), format!(
        "mutation {{ create_resource_member(input: {{ project_id: \"{p1}\", display_name: \"API company\", member_kind: \"COMPANY\" }}) {{ resource_member_id }} }}",
    )).await;
    assert!(r.errors.is_empty());
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let company = jstr(&v, &["create_resource_member", "resource_member_id"]);
    assert!(!exec(&pool, Some(owner), format!("mutation {{ create_task(input: {{ project_id: \"{p1}\", title: \"bad company assignment\", status: TODO, priority: MEDIUM, priority_order: 92, assignee_resource_member_id: \"{company}\" }}) {{ task_id }} }}")).await.errors.is_empty());
    assert!(!exec(&pool, Some(owner), format!("mutation {{ create_task(input: {{ project_id: \"{p1}\", title: \"bad foreign assignment\", status: TODO, priority: MEDIUM, priority_order: 92, assignee_resource_member_id: \"{other_member}\" }}) {{ task_id }} }}")).await.errors.is_empty());

    // Group grant restores the same canonical group member rather than inserting a duplicate.
    let r = exec(
        &pool,
        Some(owner),
        format!(
            "mutation {{ remove_project_member(project_id: \"{p1}\", user_id: \"{outsider}\") }}"
        ),
    )
    .await;
    assert!(r.errors.is_empty());
    let r = exec(
        &pool,
        Some(owner),
        format!("mutation {{ add_project_members_by_group(group_id: \"{group}\") }}"),
    )
    .await;
    assert!(r.errors.is_empty());
    let outsider_resource: Uuid = sqlx::query_scalar(
        "SELECT resource_member_id FROM project_members WHERE project_id = $1 AND user_id = $2",
    )
    .bind(p1)
    .bind(outsider)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(outsider_resource, Uuid::parse_str(&placeholder).unwrap());

    // Account deletion is database-supported: linked access/mirror clears but
    // canonical resource identity and capacity remain.
    sqlx::query("DELETE FROM users WHERE user_id = $1")
        .bind(email_user)
        .execute(&pool)
        .await
        .unwrap();
    let deleted_member: (Option<Uuid>, Option<String>) = sqlx::query_as(
        "SELECT user_id, role::text FROM project_members WHERE resource_member_id = $1",
    )
    .bind(regranted_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(deleted_member, (None, None));
    assert_eq!(
        sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>)>(
            "SELECT assignee_resource_member_id, assignee_id FROM tasks WHERE task_id = $1"
        )
        .bind(email_task)
        .fetch_one(&pool)
        .await
        .unwrap(),
        (Some(regranted_id), None)
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM member_capacity_settings WHERE resource_member_id = $1"
        )
        .bind(regranted_id)
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );

    // Owner project creation produces its canonical owner row. A manager peer
    // must not revoke that owner (also covers the protected-peer policy).
    let r = exec(&pool, Some(owner), "mutation { create_project(input: { name: \"API owner project\" }) { project_id owner { user_id } } }".into()).await;
    assert!(r.errors.is_empty(), "owner project create: {:?}", r.errors);
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let owner_project = Uuid::parse_str(&jstr(&v, &["create_project", "project_id"])).unwrap();
    assert!(exec(
        &pool,
        Some(owner),
        format!("query {{ project(project_id: \"{owner_project}\") {{ project_id }} }}")
    )
    .await
    .errors
    .is_empty());
    let owner_resource: Uuid = sqlx::query_scalar("SELECT resource_member_id FROM project_members WHERE project_id = $1 AND user_id = $2 AND role::text = 'manager'")
        .bind(owner_project).bind(owner).fetch_one(&pool).await.unwrap();
    let peer = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (user_id, email, username) VALUES ($1,'api-peer@test.local','api-peer')",
    )
    .bind(peer)
    .execute(&pool)
    .await
    .unwrap();
    let r = exec(&pool, Some(owner), format!("mutation {{ create_resource_member(input: {{ project_id: \"{owner_project}\", display_name: \"API peer\" }}) {{ resource_member_id }} }}")).await;
    assert!(r.errors.is_empty());
    let v: serde_json::Value =
        serde_json::from_str(&serde_json::to_string(&r.data).unwrap()).unwrap();
    let peer_resource = jstr(&v, &["create_resource_member", "resource_member_id"]);
    assert!(exec(&pool, Some(owner), format!("mutation {{ link_resource_member_user(resource_member_id: \"{peer_resource}\", user_id: \"{peer}\") {{ resource_member_id }} }}")).await.errors.is_empty());
    assert!(exec(&pool, Some(owner), format!("mutation {{ set_project_member_access(resource_member_id: \"{peer_resource}\", role: \"manager\") {{ access_role }} }}")).await.errors.is_empty());
    let protected_owner = exec(&pool, Some(peer), format!("mutation {{ set_project_member_access(resource_member_id: \"{owner_resource}\", role: null) {{ access_role }} }}")).await;
    assert!(
        !protected_owner.errors.is_empty(),
        "privileged peer cannot revoke owner access"
    );
    let self_grant = exec(&pool, Some(peer), format!("mutation {{ set_project_member_access(resource_member_id: \"{peer_resource}\", role: \"leader\") {{ access_role }} }}")).await;
    assert!(
        !self_grant.errors.is_empty(),
        "caller cannot change own access role"
    );

    authority_regressions::run(&pool).await;
    eprintln!("herdr_flow: ALL DB ROUND-TRIP ASSERTIONS PASSED");
}
