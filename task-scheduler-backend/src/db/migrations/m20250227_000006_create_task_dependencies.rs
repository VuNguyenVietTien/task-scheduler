use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TaskDependencies::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(TaskDependencies::TaskId).uuid().not_null())
                    .col(ColumnDef::new(TaskDependencies::DependsOnTaskId).uuid().not_null())
                    .col(ColumnDef::new(TaskDependencies::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(TaskDependencies::CreatedAt).timestamp().not_null())
                    .primary_key(
                        Index::create()
                            .name("pk_task_dependencies")
                            .col(TaskDependencies::TaskId)
                            .col(TaskDependencies::DependsOnTaskId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependency_task")
                            .from(TaskDependencies::Table, TaskDependencies::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependency_depends_on")
                            .from(TaskDependencies::Table, TaskDependencies::DependsOnTaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_dependency_created_by")
                            .from(TaskDependencies::Table, TaskDependencies::CreatedBy)
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
            .drop_table(Table::drop().table(TaskDependencies::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum TaskDependencies {
    Table,
    TaskId,
    DependsOnTaskId,
    CreatedBy,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}