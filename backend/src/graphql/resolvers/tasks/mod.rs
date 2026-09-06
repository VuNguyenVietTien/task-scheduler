use async_graphql::{Context, Object, Result, ID};

use crate::graphql::types::{
    CreateTaskInput, ReorderTasksInput, Task, UpdateTaskInput, UpdateTaskStatusInput,
};
use mutation::update_effort::UpdateTaskEffortInput;

#[derive(Default)]
pub struct TaskQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, task_id: ID) -> Result<Option<Task>> {
        query::task(ctx, task_id).await
    }

    async fn task_subtasks(&self, ctx: &Context<'_>, task_id: ID) -> Result<Vec<Task>> {
        query::task_subtasks(ctx, task_id).await
    }

    async fn tasks(
        &self,
        ctx: &Context<'_>,
        project_id: Option<ID>,
        status: Option<String>,
        assignee_id: Option<ID>,
    ) -> Result<Vec<Task>> {
        query::tasks(ctx, project_id, status, assignee_id).await
    }
}

#[derive(Default)]
pub struct TaskMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl TaskMutation {
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task> {
        mutation::create::create_task(ctx, input).await
    }

    async fn update_task(&self, ctx: &Context<'_>, input: UpdateTaskInput) -> Result<Task> {
        mutation::update::update_task(ctx, input).await
    }

    async fn update_task_status(
        &self,
        ctx: &Context<'_>,
        input: UpdateTaskStatusInput,
    ) -> Result<Task> {
        mutation::update_status::update_task_status(ctx, input).await
    }

    async fn update_task_effort(
        &self,
        ctx: &Context<'_>,
        input: UpdateTaskEffortInput,
    ) -> Result<Task> {
        mutation::update_effort::update_task_effort(ctx, input).await
    }

    async fn delete_task(&self, ctx: &Context<'_>, task_id: ID) -> Result<bool> {
        mutation::delete::delete_task(ctx, task_id).await
    }

    async fn reorder_tasks(
        &self,
        ctx: &Context<'_>,
        input: ReorderTasksInput,
    ) -> Result<Vec<Task>> {
        mutation::reorder::reorder_tasks(ctx, input).await
    }
}

mod mutation;
mod query;
