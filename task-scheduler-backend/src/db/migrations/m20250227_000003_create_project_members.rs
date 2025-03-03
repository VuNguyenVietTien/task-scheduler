use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ProjectMembers::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ProjectMembers::ProjectId).uuid().not_null())
                    .col(ColumnDef::new(ProjectMembers::UserId).uuid().not_null())
                    .col(ColumnDef::new(ProjectMembers::Role).string().not_null())
                    .col(ColumnDef::new(ProjectMembers::JoinedAt).timestamp().not_null())
                    .primary_key(
                        Index::create()
                            .name("pk_project_members")
                            .col(ProjectMembers::ProjectId)
                            .col(ProjectMembers::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_project_member_project")
                            .from(ProjectMembers::Table, ProjectMembers::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_project_member_user")
                            .from(ProjectMembers::Table, ProjectMembers::UserId)
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
            .drop_table(Table::drop().table(ProjectMembers::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ProjectMembers {
    Table,
    ProjectId,
    UserId,
    Role,
    JoinedAt,
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