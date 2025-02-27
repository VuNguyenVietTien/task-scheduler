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
                    .col(ColumnDef::new(Users::EmailVerified).boolean().not_null().default(false))
                    .col(ColumnDef::new(Users::VerificationToken).string().null())
                    .col(ColumnDef::new(Users::VerificationTokenExpires).timestamp_with_time_zone().null())
                    .col(ColumnDef::new(Users::FirebaseUid).string().null())
                    .col(ColumnDef::new(Users::Provider).string().not_null().default("email"))
                    .col(ColumnDef::new(Users::CreatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Users::UpdatedAt).timestamp_with_time_zone().not_null().default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await?;

        // ... (rest of the migration code remains the same)
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
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
    EmailVerified,
    VerificationToken,
    VerificationTokenExpires,
    FirebaseUid,
    Provider,
    CreatedAt,
    UpdatedAt,
}