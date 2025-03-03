use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop old task table
        manager
            .drop_table(
                Table::drop()
                    .table(Task::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;

        // Create new task table with updated fields
        manager
            .create_table(
                Table::create()
                    .table(Task::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Task::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Task::ProjectId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Task::Title)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Task::Description)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Task::Status)
                            .string()
                            .not_null()
                            .default("backlog"),
                    )
                    .col(
                        ColumnDef::new(Task::Priority)
                            .string()
                            .not_null()
                            .default("medium"),
                    )
                    .col(ColumnDef::new(Task::EffortHours).double())
                    .col(ColumnDef::new(Task::StartDate).timestamp_with_time_zone())
                    .col(ColumnDef::new(Task::Deadline).timestamp_with_time_zone())
                    .col(
                        ColumnDef::new(Task::CreatedBy)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Task::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Task::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_project")
                            .from(Task::Table, Task::ProjectId)
                            .to(Project::Table, Project::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_creator")
                            .from(Task::Table, Task::CreatedBy)
                            .to(User::Table, User::Id),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Task::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Task {
    Table,
    Id,
    ProjectId,
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
}

#[derive(DeriveIden)]
enum Project {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}