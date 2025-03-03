use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Notifications::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Notifications::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Notifications::UserId).uuid().not_null())
                    .col(ColumnDef::new(Notifications::Type).string().not_null())
                    .col(ColumnDef::new(Notifications::Content).json().not_null())
                    .col(ColumnDef::new(Notifications::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(Notifications::ReadAt).timestamp())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_notification_user")
                            .from(Notifications::Table, Notifications::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Add index for faster querying of unread notifications
        manager
            .create_index(
                Index::create()
                    .name("idx_notifications_unread")
                    .table(Notifications::Table)
                    .col(Notifications::UserId)
                    .col(Notifications::ReadAt)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Notifications::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Notifications {
    Table,
    Id,
    UserId,
    Type,
    Content,
    CreatedAt,
    ReadAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}