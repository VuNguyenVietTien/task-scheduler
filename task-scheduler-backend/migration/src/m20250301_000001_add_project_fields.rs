use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Projects::Table)
                    .add_column(ColumnDef::new(Projects::StartDate).timestamp_with_time_zone().null())
                    .add_column(ColumnDef::new(Projects::DueDate).timestamp_with_time_zone().null())
                    .add_column(
                        ColumnDef::new(Projects::Status)
                            .string()
                            .not_null()
                            .default("NEW"),
                    )
                    .add_column(
                        ColumnDef::new(Projects::Priority)
                            .string()
                            .not_null()
                            .default("MEDIUM"),
                    )
                    .add_column(ColumnDef::new(Projects::Category).string().null())
                    .add_column(
                        ColumnDef::new(Projects::Metadata)
                            .json()
                            .null()
                    )
                    .add_column(
                        ColumnDef::new(Projects::Visibility)
                            .string()
                            .not_null()
                            .default("PUBLIC"),
                    )
                    .add_column(
                        ColumnDef::new(Projects::Tags)
                            .array(ColumnType::String)
                            .null()
                    )
                    .add_column(
                        ColumnDef::new(Projects::Progress)
                            .float()
                            .not_null()
                            .default(0.0),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Projects::Table)
                    .drop_column(Projects::StartDate)
                    .drop_column(Projects::DueDate)
                    .drop_column(Projects::Status)
                    .drop_column(Projects::Priority)
                    .drop_column(Projects::Category)
                    .drop_column(Projects::Metadata)
                    .drop_column(Projects::Visibility)
                    .drop_column(Projects::Tags)
                    .drop_column(Projects::Progress)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
pub enum Projects {
    #[iden = "projects"]
    Table,
    StartDate,
    DueDate,
    Status,
    Priority,
    Category,
    Metadata,
    Visibility,
    Tags,
    Progress,
}