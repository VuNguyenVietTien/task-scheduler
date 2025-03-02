use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create tasks table
        manager
            .create_table(
                Table::create()
                    .table(Tasks::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Tasks::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Tasks::ProjectId).uuid().not_null())
                    .col(ColumnDef::new(Tasks::ParentTaskId).uuid().null())
                    .col(ColumnDef::new(Tasks::Title).string().not_null())
                    .col(ColumnDef::new(Tasks::Description).text().null())
                    .col(ColumnDef::new(Tasks::Status).string().not_null())
                    .col(ColumnDef::new(Tasks::Priority).string().not_null())
                    .col(ColumnDef::new(Tasks::EffortHours).float().null())
                    .col(ColumnDef::new(Tasks::StartDate).timestamp_with_time_zone().null())
                    .col(ColumnDef::new(Tasks::Deadline).timestamp_with_time_zone().null())
                    .col(ColumnDef::new(Tasks::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(Tasks::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Tasks::UpdatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Tasks::Metadata).json_binary().null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tasks_projects")
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
                            .name("fk_tasks_users")
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
                    .col(
                        ColumnDef::new(TaskAssignments::TaskId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TaskAssignments::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(ColumnDef::new(TaskAssignments::AssignedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(TaskAssignments::AssignedBy).uuid().not_null())
                    .primary_key(
                        Index::create()
                            .col(TaskAssignments::TaskId)
                            .col(TaskAssignments::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignments_tasks")
                            .from(TaskAssignments::Table, TaskAssignments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignments_users")
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

        // Create comments table
        manager
            .create_table(
                Table::create()
                    .table(Comments::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Comments::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Comments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(Comments::UserId).uuid().not_null())
                    .col(ColumnDef::new(Comments::Content).text().not_null())
                    .col(ColumnDef::new(Comments::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Comments::UpdatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Comments::ParentCommentId).uuid().null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_comments_tasks")
                            .from(Comments::Table, Comments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_comments_users")
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
                    .col(
                        ColumnDef::new(Attachments::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Attachments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(Attachments::UserId).uuid().not_null())
                    .col(ColumnDef::new(Attachments::FileName).string().not_null())
                    .col(ColumnDef::new(Attachments::FileSize).big_integer().not_null())
                    .col(ColumnDef::new(Attachments::MimeType).string().not_null())
                    .col(ColumnDef::new(Attachments::StoragePath).string().not_null())
                    .col(ColumnDef::new(Attachments::CreatedAt).timestamp_with_time_zone().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachments_tasks")
                            .from(Attachments::Table, Attachments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachments_users")
                            .from(Attachments::Table, Attachments::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop tables in reverse order
        manager
            .drop_table(Table::drop().table(Attachments::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Comments::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(TaskAssignments::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Tasks::Table).to_owned())
            .await?;

        Ok(())
    }
}

// Table identifiers
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
pub enum Projects {
    Table,
    Id,
}

#[derive(Iden)]
pub enum Users {
    Table,
    Id,
}
