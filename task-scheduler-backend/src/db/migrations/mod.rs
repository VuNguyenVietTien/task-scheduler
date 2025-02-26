use sea_orm_migration::prelude::*;
use sea_orm::DbErr;

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
                    .col(ColumnDef::new(Users::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Users::Email).string().not_null().unique_key())
                    .col(ColumnDef::new(Users::Name).string().not_null())
                    .col(ColumnDef::new(Users::PasswordHash).text().not_null())
                    .col(ColumnDef::new(Users::Role).string().not_null())
                    .col(ColumnDef::new(Users::WorkCapacity).float().not_null())
                    .col(ColumnDef::new(Users::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Users::UpdatedAt).timestamp_with_time_zone().not_null())
                    .to_owned(),
            )
            .await?;

        // Create projects table
        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .col(ColumnDef::new(Projects::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Projects::Name).string().not_null())
                    .col(ColumnDef::new(Projects::Description).text())
                    .col(ColumnDef::new(Projects::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(Projects::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Projects::UpdatedAt).timestamp_with_time_zone().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-project-user")
                            .from(Projects::Table, Projects::CreatedBy)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        // Create tasks table
        manager
            .create_table(
                Table::create()
                    .table(Tasks::Table)
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
                    .col(ColumnDef::new(Tasks::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Tasks::UpdatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Tasks::Metadata).json_binary())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-task-project")
                            .from(Tasks::Table, Tasks::ProjectId)
                            .to(Projects::Table, Projects::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-task-parent")
                            .from(Tasks::Table, Tasks::ParentTaskId)
                            .to(Tasks::Table, Tasks::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-task-user")
                            .from(Tasks::Table, Tasks::CreatedBy)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        // Create comments table
        manager
            .create_table(
                Table::create()
                    .table(Comments::Table)
                    .col(ColumnDef::new(Comments::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Comments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(Comments::UserId).uuid().not_null())
                    .col(ColumnDef::new(Comments::Content).text().not_null())
                    .col(ColumnDef::new(Comments::ParentCommentId).uuid())
                    .col(ColumnDef::new(Comments::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Comments::UpdatedAt).timestamp_with_time_zone().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-comment-task")
                            .from(Comments::Table, Comments::TaskId)
                            .to(Tasks::Table, Tasks::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-comment-user")
                            .from(Comments::Table, Comments::UserId)
                            .to(Users::Table, Users::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-comment-parent")
                            .from(Comments::Table, Comments::ParentCommentId)
                            .to(Comments::Table, Comments::Id),
                    )
                    .to_owned(),
            )
            .await?;

        // Create attachments table
        manager
            .create_table(
                Table::create()
                    .table(Attachments::Table)
                    .col(ColumnDef::new(Attachments::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Attachments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(Attachments::UserId).uuid().not_null())
                    .col(ColumnDef::new(Attachments::FileName).string().not_null())
                    .col(ColumnDef::new(Attachments::FileSize).big_integer().not_null())
                    .col(ColumnDef::new(Attachments::MimeType).string().not_null())
                    .col(ColumnDef::new(Attachments::StoragePath).text().not_null())
                    .col(ColumnDef::new(Attachments::CreatedAt).timestamp_with_time_zone().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-attachment-task")
                            .from(Attachments::Table, Attachments::TaskId)
                            .to(Tasks::Table, Tasks::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-attachment-user")
                            .from(Attachments::Table, Attachments::UserId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop tables in reverse order of creation
        manager.drop_table(Table::drop().table(Attachments::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Comments::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Tasks::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Projects::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Users::Table).to_owned()).await?;

        Ok(())
    }
}

// Table names
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
pub enum Comments {
    Table,
    Id,
    TaskId,
    UserId,
    Content,
    ParentCommentId,
    CreatedAt,
    UpdatedAt,
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
