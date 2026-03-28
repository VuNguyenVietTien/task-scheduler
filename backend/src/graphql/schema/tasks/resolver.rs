async fn tasks(
    &self,
    ctx: &Context<'_>,
    project_id: Option<ID>,
    status: Option<TaskStatus>,
    assignee_id: Option<ID>,
) -> Result<Vec<Task>> {
    let context = ctx.data::<AppContext>()?;
    let pool = &context.db_pool;
    
    let project_id_parsed = project_id.map(|id| Uuid::parse_str(&id.to_string()).ok()).flatten();
    let assignee_id_parsed = assignee_id.map(|id| Uuid::parse_str(&id.to_string()).ok()).flatten();
    
    // Convert status to string if present
    let status_str = status.map(|s| s.to_string());
    
    let tasks = sqlx::query_as!(
        Task,
        r#"
        SELECT * FROM tasks 
        WHERE ($1::uuid IS NULL OR project_id = $1)
        AND ($2::text IS NULL OR status::text = $2)
        AND ($3::uuid IS NULL OR assignee_id = $3)
        AND is_deleted = false
        ORDER BY created_at DESC
        "#,
        project_id_parsed,
        status_str,
        assignee_id_parsed
    )
    .fetch_all(pool)
    .await
    .map_err(|e| Error::new(format!("Failed to fetch tasks: {}", e)))?;
    
    Ok(tasks)
} 