use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
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
                    .col(ColumnDef::new(Tasks::EffortHours).decimal().not_null())
                    .col(ColumnDef::new(Tasks::StartDate).timestamp())
                    .col(ColumnDef::new(Tasks::Deadline).timestamp())
                    .col(ColumnDef::new(Tasks::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(Tasks::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(Tasks::UpdatedAt).timestamp().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_project")
                            .from(Tasks::Table, Tasks::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_parent")
                            .from(Tasks::Table, Tasks::ParentTaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::SetNull)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_created_by")
                            .from(Tasks::Table, Tasks::CreatedBy)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Tasks::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Tasks {
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
}

#[derive(DeriveIden)]
enum Projects {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}