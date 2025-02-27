use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create users table
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Users::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Users::Email).string().not_null().unique_key())
                    .col(ColumnDef::new(Users::Name).string().not_null())
                    .col(ColumnDef::new(Users::PasswordHash).string().not_null())
                    .col(ColumnDef::new(Users::Role).string().not_null())
                    .col(ColumnDef::new(Users::WorkCapacity).float().default(8.0))
                    .col(ColumnDef::new(Users::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Users::UpdatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await?;

        // Create projects table
        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Projects::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Projects::Name).string().not_null())
                    .col(ColumnDef::new(Projects::Description).text())
                    .col(ColumnDef::new(Projects::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(Projects::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Projects::UpdatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_projects_created_by")
                            .from(Projects::Table, Projects::CreatedBy)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Create project_members table
        manager
            .create_table(
                Table::create()
                    .table(ProjectMembers::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ProjectMembers::ProjectId).uuid().not_null())
                    .col(ColumnDef::new(ProjectMembers::UserId).uuid().not_null())
                    .col(ColumnDef::new(ProjectMembers::Role).string().not_null())
                    .col(ColumnDef::new(ProjectMembers::JoinedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .primary_key(Index::create().col(ProjectMembers::ProjectId).col(ProjectMembers::UserId))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_project_members_project")
                            .from(ProjectMembers::Table, ProjectMembers::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_project_members_user")
                            .from(ProjectMembers::Table, ProjectMembers::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create tasks table
        manager
            .create_table(
                Table::create()
                    .table(Tasks::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Tasks::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Tasks::ProjectId).uuid().not_null())
                    .col(ColumnDef::new(Tasks::ParentTaskId).uuid())
                    .col(ColumnDef::new(Tasks::Title).string().not_null())
                    .col(ColumnDef::new(Tasks::Description).text())
                    .col(ColumnDef::new(Tasks::Status).string().not_null())
                    .col(ColumnDef::new(Tasks::Priority).string().not_null())
                    .col(ColumnDef::new(Tasks::EffortHours).float())
                    .col(ColumnDef::new(Tasks::StartDate).timestamp_with_time_zone())
                    .col(ColumnDef::new(Tasks::Deadline).timestamp_with_time_zone())
                    .col(ColumnDef::new(Tasks::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(Tasks::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Tasks::UpdatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Tasks::Metadata).json())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tasks_project")
                            .from(Tasks::Table, Tasks::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tasks_parent")
                            .from(Tasks::Table, Tasks::ParentTaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tasks_created_by")
                            .from(Tasks::Table, Tasks::CreatedBy)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Create task_assignments table
        manager
            .create_table(
                Table::create()
                    .table(TaskAssignments::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(TaskAssignments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(TaskAssignments::UserId).uuid().not_null())
                    .col(ColumnDef::new(TaskAssignments::AssignedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(TaskAssignments::AssignedBy).uuid().not_null())
                    .primary_key(Index::create().col(TaskAssignments::TaskId).col(TaskAssignments::UserId))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignments_task")
                            .from(TaskAssignments::Table, TaskAssignments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignments_user")
                            .from(TaskAssignments::Table, TaskAssignments::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignments_assigned_by")
                            .from(TaskAssignments::Table, TaskAssignments::AssignedBy)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Create task_dependencies table
        manager
            .create_table(
                Table::create()
                    .table(TaskDependencies::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(TaskDependencies::DependentTaskId).uuid().not_null())
                    .col(ColumnDef::new(TaskDependencies::DependencyTaskId).uuid().not_null())
                    .col(ColumnDef::new(TaskDependencies::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .primary_key(Index::create().col(TaskDependencies::DependentTaskId).col(TaskDependencies::DependencyTaskId))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependencies_dependent")
                            .from(TaskDependencies::Table, TaskDependencies::DependentTaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependencies_dependency")
                            .from(TaskDependencies::Table, TaskDependencies::DependencyTaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create comments table
        manager
            .create_table(
                Table::create()
                    .table(Comments::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Comments::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Comments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(Comments::UserId).uuid().not_null())
                    .col(ColumnDef::new(Comments::Content).text().not_null())
                    .col(ColumnDef::new(Comments::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Comments::UpdatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Comments::ParentCommentId).uuid())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_comments_task")
                            .from(Comments::Table, Comments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_comments_user")
                            .from(Comments::Table, Comments::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_comments_parent")
                            .from(Comments::Table, Comments::ParentCommentId)
                            .to(Comments::Table, Comments::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // Create attachments table
        manager
            .create_table(
                Table::create()
                    .table(Attachments::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Attachments::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Attachments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(Attachments::UserId).uuid().not_null())
                    .col(ColumnDef::new(Attachments::FileName).string().not_null())
                    .col(ColumnDef::new(Attachments::FileSize).big_integer().not_null())
                    .col(ColumnDef::new(Attachments::MimeType).string().not_null())
                    .col(ColumnDef::new(Attachments::StoragePath).string().not_null())
                    .col(ColumnDef::new(Attachments::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachments_task")
                            .from(Attachments::Table, Attachments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachments_user")
                            .from(Attachments::Table, Attachments::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Create notifications table
        manager
            .create_table(
                Table::create()
                    .table(Notifications::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Notifications::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Notifications::UserId).uuid().not_null())
                    .col(ColumnDef::new(Notifications::Type).string().not_null())
                    .col(ColumnDef::new(Notifications::Content).json().not_null())
                    .col(ColumnDef::new(Notifications::ReadAt).timestamp_with_time_zone())
                    .col(ColumnDef::new(Notifications::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_notifications_user")
                            .from(Notifications::Table, Notifications::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_users_email")
                    .table(Users::Table)
                    .col(Users::Email)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_projects_created_by")
                    .table(Projects::Table)
                    .col(Projects::CreatedBy)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_project")
                    .table(Tasks::Table)
                    .col(Tasks::ProjectId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_status")
                    .table(Tasks::Table)
                    .col(Tasks::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_tasks_deadline")
                    .table(Tasks::Table)
                    .col(Tasks::Deadline)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_notifications_user")
                    .table(Notifications::Table)
                    .col(Notifications::UserId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Notifications::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Attachments::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Comments::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(TaskDependencies::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(TaskAssignments::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Tasks::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(ProjectMembers::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Projects::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Users::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
pub enum Users {
    Table,
    Id,
    Email,
    Name,
    PasswordHash,
    Role,
    WorkCapacity,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
pub enum Projects {
    Table,
    Id,
    Name,
    Description,
    CreatedBy,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
pub enum ProjectMembers {
    Table,
    ProjectId,
    UserId,
    Role,
    JoinedAt,
}

#[derive(Iden)]
pub enum Tasks {
    Table,
    Id,
    ProjectId,
    ParentTaskId,
    Title,
    Description,
    Status,
    Priority,
    EffortHours,
    StartDate,
    Deadline,
    CreatedBy,
    CreatedAt,
    UpdatedAt,
    Metadata,
}

#[derive(Iden)]
pub enum TaskAssignments {
    Table,
    TaskId,
    UserId,
    AssignedAt,
    AssignedBy,
}

#[derive(Iden)]
pub enum TaskDependencies {
    Table,
    DependentTaskId,
    DependencyTaskId,
    CreatedAt,
}

#[derive(Iden)]
pub enum Comments {
    Table,
    Id,
    TaskId,
    UserId,
    Content,
    CreatedAt,
    UpdatedAt,
    ParentCommentId,
}

#[derive(Iden)]
pub enum Attachments {
    Table,
    Id,
    TaskId,
    UserId,
    FileName,
    FileSize,
    MimeType,
    StoragePath,
    CreatedAt,
}

#[derive(Iden)]
pub enum Notifications {
    Table,
    Id,
    UserId,
    Type,
    Content,
    ReadAt,
    CreatedAt,
}