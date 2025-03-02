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
                    .col(
                        ColumnDef::new(Users::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Users::Email).string().not_null().unique_key())
                    .col(ColumnDef::new(Users::Name).string().not_null())
                    .col(ColumnDef::new(Users::PasswordHash).string().not_null())
                    .col(ColumnDef::new(Users::Role).string().not_null())
                    .col(ColumnDef::new(Users::WorkCapacity).float().null())
                    .col(ColumnDef::new(Users::EmailVerified).boolean().not_null().default(false))
                    .col(ColumnDef::new(Users::VerificationToken).string().null())
                    .col(ColumnDef::new(Users::VerificationTokenExpires).timestamp_with_time_zone().null())
                    .col(ColumnDef::new(Users::FirebaseUid).string().null())
                    .col(ColumnDef::new(Users::Provider).string().not_null())
                    .col(ColumnDef::new(Users::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Users::UpdatedAt).timestamp_with_time_zone().not_null())
                    .to_owned(),
            )
            .await?;

        // Create projects table
        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Projects::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Projects::Name).string().not_null())
                    .col(ColumnDef::new(Projects::Description).text().null())
                    .col(ColumnDef::new(Projects::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(Projects::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Projects::UpdatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Projects::Status).string().not_null())
                    .col(ColumnDef::new(Projects::Priority).string().not_null())
                    .col(ColumnDef::new(Projects::Category).text().null())
                    .col(ColumnDef::new(Projects::Metadata).json_binary().null())
                    .col(ColumnDef::new(Projects::Visibility).string().not_null())
                    .col(ColumnDef::new(Projects::Tags).json_binary().null())
                    .col(ColumnDef::new(Projects::Progress).float().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_projects_users")
                            .from(Projects::Table, Projects::CreatedBy)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Restrict)
                            .on_update(ForeignKeyAction::NoAction),
                    )
                    .to_owned(),
            )
            .await?;

        // Create project_members table
        manager
            .create_table(
                Table::create()
                    .table(ProjectMembers::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ProjectMembers::ProjectId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProjectMembers::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(ColumnDef::new(ProjectMembers::Role).string().not_null())
                    .col(ColumnDef::new(ProjectMembers::JoinedAt).timestamp_with_time_zone().not_null())
                    .primary_key(
                        Index::create()
                            .col(ProjectMembers::ProjectId)
                            .col(ProjectMembers::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_project_members_project")
                            .from(ProjectMembers::Table, ProjectMembers::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::NoAction),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_project_members_user")
                            .from(ProjectMembers::Table, ProjectMembers::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::NoAction),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop tables in reverse order
        manager
            .drop_table(Table::drop().table(ProjectMembers::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Projects::Table).to_owned())
            .await?;

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

#[derive(Iden)]
pub enum Projects {
    Table,
    Id,
    Name,
    Description,
    CreatedBy,
    CreatedAt,
    UpdatedAt,
    Status,
    Priority,
    Category,
    Metadata,
    Visibility,
    Tags,
    Progress,
}

#[derive(Iden)]
pub enum ProjectMembers {
    Table,
    ProjectId,
    UserId,
    Role,
    JoinedAt,
}
