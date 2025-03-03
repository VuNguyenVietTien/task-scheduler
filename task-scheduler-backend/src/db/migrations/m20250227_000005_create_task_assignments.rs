use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TaskAssignments::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(TaskAssignments::TaskId).uuid().not_null())
                    .col(ColumnDef::new(TaskAssignments::UserId).uuid().not_null())
                    .col(ColumnDef::new(TaskAssignments::AssignedBy).uuid().not_null())
                    .col(ColumnDef::new(TaskAssignments::AssignedAt).timestamp().not_null())
                    .primary_key(
                        Index::create()
                            .name("pk_task_assignments")
                            .col(TaskAssignments::TaskId)
                            .col(TaskAssignments::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignment_task")
                            .from(TaskAssignments::Table, TaskAssignments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignment_user")
                            .from(TaskAssignments::Table, TaskAssignments::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_assignment_assigned_by")
                            .from(TaskAssignments::Table, TaskAssignments::AssignedBy)
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
            .drop_table(Table::drop().table(TaskAssignments::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum TaskAssignments {
    Table,
    TaskId,
    UserId,
    AssignedBy,
    AssignedAt,
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