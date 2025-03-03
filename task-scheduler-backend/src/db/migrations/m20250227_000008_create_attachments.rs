use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
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
                    .col(ColumnDef::new(Attachments::CreatedAt).timestamp().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachment_task")
                            .from(Attachments::Table, Attachments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachment_user")
                            .from(Attachments::Table, Attachments::UserId)
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
            .drop_table(Table::drop().table(Attachments::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Attachments {
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