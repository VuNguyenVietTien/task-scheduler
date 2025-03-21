import { gql } from '@apollo/client';

export const typeDefs = gql`
  enum MemberRole {
    Admin
    Member
    Viewer
  }

  type ProjectMember {
    memberId: String!
    userId: String!
    role: MemberRole!
    joinedAt: DateTime!
    invitedBy: String
    user: UserResponse!
  }

  type UserResponse {
    id: String!
    email: String!
    username: String!
    fullName: String
    avatarUrl: String
  }

  input AddMemberInput {
    email: String!
    role: MemberRole!
  }

  input UpdateMemberRoleInput {
    memberId: String!
    role: MemberRole!
  }

  extend type Query {
    projectMembers(projectId: ID!): [ProjectMember!]!
    myProjectRole(projectId: ID!): MemberRole
  }

  extend type Mutation {
    addProjectMember(projectId: ID!, input: AddMemberInput!): ProjectMember!
    updateMemberRole(projectId: ID!, input: UpdateMemberRoleInput!): ProjectMember!
    removeProjectMember(projectId: ID!, memberId: ID!): Boolean!
  }
`; 