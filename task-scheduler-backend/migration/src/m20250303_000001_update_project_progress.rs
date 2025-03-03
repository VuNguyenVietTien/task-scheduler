use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // First drop the column
        manager
            .alter_table(
                Table::alter()
                    .table(Projects::Table)
                    .drop_column(Projects::Progress)
                    .to_owned(),
            )
            .await?;

        // Then add it back with the correct type
        manager
            .alter_table(
                Table::alter()
                    .table(Projects::Table)
                    .add_column(
                        ColumnDef::new(Projects::Progress)
                            .double()
                            .not_null()
                            .default(0.0),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Convert back to float
        manager
            .alter_table(
                Table::alter()
                    .table(Projects::Table)
                    .modify_column(
                        ColumnDef::new(Projects::Progress)
                            .float()
                            .not_null()
                            .default(0.0),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
pub enum Projects {
    Table,
    Progress,
}