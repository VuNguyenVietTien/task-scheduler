use async_graphql::*;
use uuid::Uuid;
use sqlx::PgPool;
use chrono::{Utc, DateTime};

use crate::graphql::resolvers::members::types::{ProjectMember, AddMemberInput, UpdateMemberRoleInput, MemberRole};
use crate::entities::{ProjectMemberEntity, UserEntity, ProjectEntity, TaskEntity};

#[derive(Default)]
pub struct MemberMutation;

#[Object]
impl MemberMutation {
    pub async fn add_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        input: AddMemberInput,
    ) -> Result<ProjectMember> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;

        // Check if current user is admin
        let current_role = sqlx::query(
            "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2"
        )
        .bind(project_id)
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| row.get::<MemberRole, _>("role"))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .ok_or_else(|| async_graphql::Error::new("User is not a member of this project"))?;

        if current_role != MemberRole::Admin {
            return Err(async_graphql::Error::new("Only admin can add members"));
        }

        // Find user by email
        let target_user = sqlx::query(
            "SELECT user_id FROM users WHERE email = $1"
        )
        .bind(&input.email)
        .map(|row: sqlx::postgres::PgRow| row.get::<Uuid, _>("user_id"))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .ok_or_else(|| async_graphql::Error::new("User not found"))?;

        // Check if user is already a member
        let existing_member = sqlx::query(
            "SELECT member_id FROM project_members WHERE project_id = $1 AND user_id = $2"
        )
        .bind(project_id)
        .bind(target_user)
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

        if existing_member.is_some() {
            return Err(async_graphql::Error::new("User is already a member of this project"));
        }

        // Add member
        let record = sqlx::query(
            "INSERT INTO project_members (member_id, project_id, user_id, role, joined_at, invited_by)
             VALUES ($1, $2, $3, $4, NOW(), $5)
             RETURNING member_id, project_id, user_id, role, joined_at, invited_by,
                       (SELECT email FROM users WHERE user_id = $3) as email,
                       (SELECT username FROM users WHERE user_id = $3) as username,
                       (SELECT full_name FROM users WHERE user_id = $3) as full_name,
                       (SELECT avatar_url FROM users WHERE user_id = $3) as avatar_url"
        )
        .bind(Uuid::new_v4())
        .bind(project_id)
        .bind(target_user)
        .bind(input.role)
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| ProjectMember::try_from(row))
        .fetch_one(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }

    pub async fn update_member_role(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        input: UpdateMemberRoleInput,
    ) -> Result<ProjectMember> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;
        let member_id = Uuid::parse_str(&input.member_id)
            .map_err(|_| async_graphql::Error::new("Invalid member ID"))?;

        // Check if current user is admin
        let current_role = sqlx::query(
            "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2"
        )
        .bind(project_id)
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| row.get::<MemberRole, _>("role"))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .ok_or_else(|| async_graphql::Error::new("User is not a member of this project"))?;

        if current_role != MemberRole::Admin {
            return Err(async_graphql::Error::new("Only admin can update member roles"));
        }

        // Update role
        let record = sqlx::query(
            "UPDATE project_members 
             SET role = $1
             WHERE member_id = $2 AND project_id = $3
             RETURNING member_id, project_id, user_id, role, joined_at, invited_by,
                       (SELECT email FROM users WHERE user_id = project_members.user_id) as email,
                       (SELECT username FROM users WHERE user_id = project_members.user_id) as username,
                       (SELECT full_name FROM users WHERE user_id = project_members.user_id) as full_name,
                       (SELECT avatar_url FROM users WHERE user_id = project_members.user_id) as avatar_url"
        )
        .bind(input.role)
        .bind(member_id)
        .bind(project_id)
        .map(|row: sqlx::postgres::PgRow| ProjectMember::try_from(row))
        .fetch_one(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }

    pub async fn remove_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        member_id: ID,
    ) -> Result<bool> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;
        let project_id = Uuid::parse_str(&project_id)
            .map_err(|_| async_graphql::Error::new("Invalid project ID"))?;
        let member_id = Uuid::parse_str(&member_id)
            .map_err(|_| async_graphql::Error::new("Invalid member ID"))?;

        // Check if current user is admin
        let current_role = sqlx::query(
            "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2"
        )
        .bind(project_id)
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| row.get::<MemberRole, _>("role"))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .ok_or_else(|| async_graphql::Error::new("User is not a member of this project"))?;

        if current_role != MemberRole::Admin {
            return Err(async_graphql::Error::new("Only admin can remove members"));
        }

        // Get user_id of member to be removed
        let target_user_id = sqlx::query(
            "SELECT user_id FROM project_members WHERE member_id = $1 AND project_id = $2"
        )
        .bind(member_id)
        .bind(project_id)
        .map(|row: sqlx::postgres::PgRow| row.get::<Uuid, _>("user_id"))
        .fetch_one(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

        // Start transaction
        let mut tx = db.begin().await
            .map_err(|e| async_graphql::Error::new(format!("Transaction error: {}", e)))?;

        // Remove member
        sqlx::query("DELETE FROM project_members WHERE member_id = $1 AND project_id = $2")
            .bind(member_id)
            .bind(project_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

        // Update tasks assigned to removed member
        sqlx::query(
            "UPDATE tasks 
             SET assignee_id = NULL 
             WHERE project_id = $1 AND assignee_id = $2"
        )
        .bind(project_id)
        .bind(target_user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?;

        // Commit transaction
        tx.commit().await
            .map_err(|e| async_graphql::Error::new(format!("Transaction error: {}", e)))?;

        Ok(true)
    }

    pub async fn add_project_member_by_email(
        &self,
        ctx: &Context,
        project_id: ID,
        email: String,
        role: ProjectRole,
    ) -> Result<ProjectMember> {
        let current_user_id = ctx.current_user_id()?;
        let conn = ctx.db_pool().get()?;

        // Kiểm tra quyền admin của user hiện tại trong project
        let admin_check = ProjectMemberEntity::find_by_project_and_user(&conn, &project_id.to_string(), &current_user_id.to_string())?;
        
        if admin_check.is_none() || admin_check.unwrap().role != ProjectRole::owner.to_string() {
            return Err(Error::Forbidden("You don't have permission to add members to this project".into()));
        }
        
        // Tìm user theo email
        let user = UserEntity::find_by_email(&conn, &email)?
            .ok_or_else(|| Error::NotFound(format!("User with email {} not found", email)))?;
        
        // Kiểm tra xem thành viên đã tồn tại trong dự án chưa
        let existing_member = ProjectMemberEntity::find_by_project_and_user(&conn, &project_id.to_string(), &user.user_id)?;
        
        if existing_member.is_some() {
            return Err(Error::BadRequest("User is already a member of this project".into()));
        }
        
        // Thêm thành viên vào dự án
        let new_member = NewProjectMember {
            project_id: project_id.to_string(),
            user_id: user.user_id.clone(),
            role: role.to_string(),
            joined_at: Utc::now().naive_utc(),
            invited_by: Some(current_user_id.to_string()),
        };
        
        let member = ProjectMemberEntity::create(&conn, &new_member)?;
        
        // Cập nhật số lượng thành viên trong dự án
        ProjectEntity::update_member_count(&conn, &project_id.to_string())?;
        
        Ok(ProjectMember {
            project_id,
            user_id: ID::from(member.user_id),
            user: ctx.user_loader().load(ID::from(user.user_id)).await?,
            role,
            joined_at: DateTime::<Utc>::from_naive_utc_and_offset(member.joined_at, Utc),
        })
    }

    pub async fn update_project_member_role(
        &self,
        ctx: &Context,
        project_id: ID,
        user_id: ID,
        role: ProjectRole,
    ) -> Result<ProjectMember> {
        let current_user_id = ctx.current_user_id()?;
        let conn = ctx.db_pool().get()?;
        
        // Kiểm tra quyền admin của user hiện tại trong project
        let admin_check = ProjectMemberEntity::find_by_project_and_user(&conn, &project_id.to_string(), &current_user_id.to_string())?;
        
        if admin_check.is_none() || admin_check.unwrap().role != ProjectRole::owner.to_string() {
            return Err(Error::Forbidden("You don't have permission to update member roles in this project".into()));
        }
        
        // Không cho phép thay đổi role của owner
        let member = ProjectMemberEntity::find_by_project_and_user(&conn, &project_id.to_string(), &user_id.to_string())?
            .ok_or_else(|| Error::NotFound("Project member not found".into()))?;
        
        if member.role == ProjectRole::owner.to_string() {
            return Err(Error::BadRequest("Cannot change role of the project owner".into()));
        }
        
        // Cập nhật role
        let updated = ProjectMemberEntity::update_role(&conn, &project_id.to_string(), &user_id.to_string(), &role.to_string())?;
        
        Ok(ProjectMember {
            project_id,
            user_id,
            user: ctx.user_loader().load(user_id.clone()).await?,
            role,
            joined_at: DateTime::<Utc>::from_naive_utc_and_offset(updated.joined_at, Utc),
        })
    }

    pub async fn remove_project_member(
        &self,
        ctx: &Context,
        project_id: ID,
        user_id: ID,
    ) -> Result<bool> {
        let current_user_id = ctx.current_user_id()?;
        let conn = ctx.db_pool().get()?;
        
        // Kiểm tra quyền admin của user hiện tại trong project
        let admin_check = ProjectMemberEntity::find_by_project_and_user(&conn, &project_id.to_string(), &current_user_id.to_string())?;
        
        if admin_check.is_none() || admin_check.unwrap().role != ProjectRole::owner.to_string() {
            return Err(Error::Forbidden("You don't have permission to remove members from this project".into()));
        }
        
        // Không cho phép xóa owner
        let member = ProjectMemberEntity::find_by_project_and_user(&conn, &project_id.to_string(), &user_id.to_string())?
            .ok_or_else(|| Error::NotFound("Project member not found".into()))?;
        
        if member.role == ProjectRole::owner.to_string() {
            return Err(Error::BadRequest("Cannot remove the project owner".into()));
        }
        
        // Xóa thành viên
        ProjectMemberEntity::delete(&conn, &project_id.to_string(), &user_id.to_string())?;
        
        // Cập nhật số lượng thành viên dự án
        ProjectEntity::update_member_count(&conn, &project_id.to_string())?;
        
        // Cập nhật assignee_id trong tasks
        TaskEntity::clear_assignee(&conn, &project_id.to_string(), &user_id.to_string())?;
        
        Ok(true)
    }
} 