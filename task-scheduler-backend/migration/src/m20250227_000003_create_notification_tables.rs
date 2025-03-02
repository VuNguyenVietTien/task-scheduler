use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create notifications table
        manager
            .create_table(
                Table::create()
                    .table(Notifications::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Notifications::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Notifications::UserId).uuid().not_null())
                    .col(ColumnDef::new(Notifications::Type).string().not_null())
                    .col(ColumnDef::new(Notifications::Content).json_binary().not_null())
                    .col(ColumnDef::new(Notifications::ReadAt).timestamp_with_time_zone().null())
                    .col(ColumnDef::new(Notifications::CreatedAt).timestamp_with_time_zone().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_notifications_users")
                            .from(Notifications::Table, Notifications::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
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
                    .col(
                        ColumnDef::new(TaskDependencies::DependentTaskId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TaskDependencies::DependencyTaskId)
                            .uuid()
                            .not_null(),
                    )
                    .col(ColumnDef::new(TaskDependencies::CreatedAt).timestamp_with_time_zone().not_null())
                    .primary_key(
                        Index::create()
                            .col(TaskDependencies::DependentTaskId)
                            .col(TaskDependencies::DependencyTaskId),
                    )
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

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop tables in reverse order
        manager
            .drop_table(Table::drop().table(TaskDependencies::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Notifications::Table).to_owned())
            .await?;

        Ok(())
    }
}

// Table identifiers
#[derive(Iden)]
pub enum Notifications {
    Table,
    Id,
    UserId,
    #[iden = "type"]
    Type,
    Content,
    ReadAt,
    CreatedAt,
}

#[derive(Iden)]
pub enum TaskDependencies {
    Table,
    DependentTaskId,
    DependencyTaskId,
    CreatedAt,
}

#[derive(Iden)]
pub enum Tasks {
    Table,
    Id,
}

#[derive(Iden)]
pub enum Users {
    Table,
    Id,
}
