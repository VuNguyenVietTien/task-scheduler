use async_graphql::*;
use crate::graphql::context::ApiContext;
use super::types::*;

#[derive(Default)]
pub struct PlanQuery;

#[Object]
impl PlanQuery {
    /// Lấy danh sách plans của một project
    async fn get_project_plans(&self, ctx: &Context<'_>, project_id: String) -> Result<Vec<Plan>> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database query
        Ok(vec![])
    }

    /// Lấy plan mới nhất của một project
    async fn get_latest_project_plan(&self, ctx: &Context<'_>, project_id: String) -> Result<Option<Plan>> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database query
        Ok(None)
    }

    /// Lấy plan theo ID
    async fn get_plan(&self, ctx: &Context<'_>, id: String) -> Result<Option<Plan>> {
        let context = ctx.data::<ApiContext>()?;
        // TODO: Implement database query
        Ok(None)
    }
} 