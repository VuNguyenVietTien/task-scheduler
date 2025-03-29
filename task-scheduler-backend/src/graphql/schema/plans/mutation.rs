use async_graphql::*;
use crate::graphql::context::ApiContext;
use super::types::*;

#[derive(Default)]
pub struct PlanMutation;

#[Object]
impl PlanMutation {
    /// Tạo mới plan
    async fn create_plan(&self, ctx: &Context<'_>, input: CreatePlanInput) -> Result<Plan> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database insert
        Err("Not implemented".into())
    }

    /// Cập nhật plan
    async fn update_plan(&self, ctx: &Context<'_>, input: UpdatePlanInput) -> Result<Plan> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database update
        Err("Not implemented".into())
    }

    /// Xóa plan
    async fn delete_plan(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database delete
        Err("Not implemented".into())
    }

    /// Đặt plan là active
    async fn set_plan_active(&self, ctx: &Context<'_>, id: String) -> Result<Plan> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database update
        Err("Not implemented".into())
    }
} 