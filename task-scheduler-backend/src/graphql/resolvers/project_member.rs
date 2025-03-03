use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, EntityTrait, IntoActiveModel, QueryFilter, ColumnTrait,
    DeleteResult, Set,
};
use uuid::Uuid;
use log::debug;

use crate::{
    db::{
        entities::{
            ProjectMemberEntity, ProjectMemberModel, ProjectMemberActiveModel,
        },
        enums::MemberRole,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::{ProjectMember, AddProjectMemberInput, UpdateMemberRoleInput, MemberRoleEnum},
    },
};

#[derive(Default)]
pub struct ProjectMemberQuery;

#[Object]
impl ProjectMemberQuery {
    async fn project_member(
        &self, 
        ctx: &Context<'_>, 
        project_id: ID,
        user_id: ID,
    ) -> Result<Option<ProjectMember>, Error> {
        let db = ctx.get_db();
        let project_uuid = Uuid::parse_str(&project_id.to_string())?;
        let user_uuid = Uuid::parse_str(&user_id.to_string())?;

        let member = ProjectMemberEntity::find()
            .filter(crate::db::entities::project_member::Column::ProjectId.eq(project_uuid))
            .filter(crate::db::entities::project_member::Column::UserId.eq(user_uuid))
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(member.map(|m| m.into()))
    }

    async fn project_members(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<ProjectMember>, Error> {
        let db = ctx.get_db();
        let project_uuid = Uuid::parse_str(&project_id.to_string())?;

        let members = ProjectMemberEntity::find()
            .filter(crate::db::entities::project_member::Column::ProjectId.eq(project_uuid))
            .all(db)
            .await
            .map_err(map_db_err)?;

        Ok(members.into_iter().map(|m| m.into()).collect())
    }
}

#[derive(Default)]
pub struct ProjectMemberMutation;

#[Object]
impl ProjectMemberMutation {
    async fn add_project_member(
        &self,
        ctx: &Context<'_>,
        input: AddProjectMemberInput,
    ) -> Result<ProjectMember, Error> {
        let db = ctx.get_db();
        
        let project_id = Uuid::parse_str(&input.project_id.to_string())?;
        let user_id = Uuid::parse_str(&input.user_id.to_string())?;

        debug!("Adding member with role: {:?}", input.role);

        let member = ProjectMemberActiveModel {
            project_id: Set(project_id),
            user_id: Set(user_id),
            role: Set(MemberRole::from(input.role).to_string()),
            joined_at: Set(current_time_db()),
        };

        let member = member.insert(db).await.map_err(map_db_err)?;

        Ok(member.into())
    }

    async fn update_member_role(
        &self,
        ctx: &Context<'_>,
        input: UpdateMemberRoleInput,
    ) -> Result<ProjectMember, Error> {
        let db = ctx.get_db();
        let project_id = Uuid::parse_str(&input.project_id.to_string())?;
        let user_id = Uuid::parse_str(&input.user_id.to_string())?;

        debug!("Updating member role to: {:?}", input.role);

        let member = ProjectMemberEntity::find()
            .filter(crate::db::entities::project_member::Column::ProjectId.eq(project_id))
            .filter(crate::db::entities::project_member::Column::UserId.eq(user_id))
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Project member not found"))?;

        let mut member = member.into_active_model();
        member.role = Set(MemberRole::from(input.role).to_string());

        let member = member.update(db).await.map_err(map_db_err)?;

        Ok(member.into())
    }

    async fn remove_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<bool, Error> {
        let db = ctx.get_db();
        let project_uuid = Uuid::parse_str(&project_id.to_string())?;
        let user_uuid = Uuid::parse_str(&user_id.to_string())?;

        let result = ProjectMemberEntity::delete_many()
            .filter(crate::db::entities::project_member::Column::ProjectId.eq(project_uuid))
            .filter(crate::db::entities::project_member::Column::UserId.eq(user_uuid))
            .exec(db)
            .await
            .map_err(map_db_err)?;

        Ok(result.rows_affected > 0)
    }
}

impl From<ProjectMemberModel> for ProjectMember {
    fn from(model: ProjectMemberModel) -> Self {
        let role: MemberRole = serde_json::from_str(&format!("\"{}\"", model.role))
            .unwrap_or_default();
        let role_enum = MemberRoleEnum::from(role);

        ProjectMember {
            project_id: model.project_id.into(),
            user_id: model.user_id.into(),
            role: role_enum,
            joined_at: model.joined_at,
        }
    }
}