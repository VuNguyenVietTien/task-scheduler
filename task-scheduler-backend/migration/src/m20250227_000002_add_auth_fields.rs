use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add new columns to users table
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .add_column(
                        ColumnDef::new(Alias::new("email_verified"))
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .add_column(
                        ColumnDef::new(Alias::new("verification_token"))
                            .string()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(Alias::new("verification_token_expires"))
                            .timestamp_with_time_zone()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(Alias::new("firebase_uid"))
                            .string()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(Alias::new("provider"))
                            .string()
                            .not_null()
                            .default("email"),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Remove the added columns
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .drop_column(Alias::new("email_verified"))
                    .drop_column(Alias::new("verification_token"))
                    .drop_column(Alias::new("verification_token_expires"))
                    .drop_column(Alias::new("firebase_uid"))
                    .drop_column(Alias::new("provider"))
                    .to_owned(),
            )
            .await
    }
}
