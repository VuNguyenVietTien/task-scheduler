export const taskSchedulerTypeDefs = `
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  enum TaskStatus {
    TODO
    DOING
    DONE
    CLOSE
    PENDING
    REVIEW
    BLOCKED
    REJECTED
    ARCHIVED
  }

  enum TaskPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
    CRITICAL
  }

  enum TaskProgressType {
    STUDY
    INVESTIGATE
    CODE
    TEST
    REVIEW_CODE
    REVIEW_TEST_REPORT
    RELEASE
  }

  enum ProjectStatus {
    ACTIVE
    COMPLETED
    ON_HOLD
    CANCELLED
  }

  enum ProjectPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  enum ProjectVisibility {
    PUBLIC
    PRIVATE
    TEAM
  }

  enum MemberRole {
    MANAGER
    LEADER
    MEMBER
    GUEST
  }

  type User {
    user_id: ID!
    email: String!
    username: String
    full_name: String
    avatar_url: String
  }

  type AuthUser {
    id: ID!
    email: String!
    name: String
    role: String
    verified: Boolean
  }

  type AuthResponse {
    token: String!
    expires_in: Int
    user: AuthUser!
  }

  type ProjectMember {
    role: MemberRole!
    joined_at: String
    position: String
    user: User!
  }

  type Project {
    project_id: ID!
    name: String!
    description: String
    created_at: String
    updated_at: String
    priority: ProjectPriority
    visibility: ProjectVisibility
    status: ProjectStatus
    tags: [String]
    progress: Float
    category: String
    metadata: String
    start_date: String
    end_date: String
    icon_url: String
    is_public: Boolean
    member_count: Int
    owner: User
    created_by: User
    user_role: String
    members: [ProjectMember]
  }

  type Assignee {
    user_id: ID!
    username: String
    full_name: String
    avatar_url: String
    role: String
  }

  type Task {
    task_id: ID!
    project_id: ID!
    parent_task_id: ID
    title: String!
    description: String
    status: TaskStatus
    priority: TaskPriority
    priority_order: Int
    start_date: String
    due_date: String
    actual_start_date: String
    actual_end_date: String
    effort: Float
    progress: Float
    progress_type: TaskProgressType
    assignee: Assignee
    created_by: ID
    creator: Assignee
    created_at: String
    updated_at: String
    is_deleted: Boolean
    type_: String
    category: String
    tags: [String]
    child_tasks: [Task]
  }

  type CommentResponse {
    id: ID!
    task_id: ID!
    user_id: ID!
    content: String!
    username: String
    avatar_url: String
    parent_comment_id: ID
    created_at: String
    updated_at: String
    is_deleted: Boolean
  }

  type Notification {
    notification_id: ID!
    user_id: ID!
    project_id: ID
    sender_id: ID
    type_: String
    reference_type: String
    reference_id: ID
    message: String
    action: String
    metadata: String
    is_read: Boolean
    created_at: String
  }

  type NotificationCount {
    total: Int!
    unread: Int!
  }

  type Plan {
    id: ID!
    project_id: ID!
    name: String!
    description: String
    is_active: Boolean
    plan_data: String
    created_at: String
    updated_at: String
  }

  input CreateProjectInput {
    name: String!
    description: String
    priority: ProjectPriority
    visibility: ProjectVisibility
    status: ProjectStatus
    tags: [String]
    category: String
    start_date: String
    end_date: String
    icon_url: String
    is_public: Boolean
  }

  input UpdateProjectInput {
    project_id: ID!
    name: String
    description: String
    priority: ProjectPriority
    visibility: ProjectVisibility
    status: ProjectStatus
    tags: [String]
    progress: Float
    category: String
    start_date: String
    end_date: String
    icon_url: String
    is_public: Boolean
  }

  input AddProjectMemberInput {
    project_id: ID!
    user_id: ID!
    role: MemberRole!
  }

  input UpdateProjectMemberInput {
    project_id: ID!
    user_id: ID!
    role: MemberRole!
  }

  input MemberRoleUpdate {
    userId: ID!
    role: String!
  }

  type UpdateMultipleMembersResult {
    success_count: Int!
    members: [ProjectMember!]!
  }

  input CreateTaskInput {
    project_id: ID!
    parent_task_id: ID
    title: String!
    description: String
    status: TaskStatus
    priority: TaskPriority
    start_date: String
    due_date: String
    effort: Float
    progress: Float
    progress_type: TaskProgressType
    assignee_id: ID
    type_: String
    category: String
    tags: [String]
  }

  input UpdateTaskInput {
    task_id: ID!
    title: String
    description: String
    status: TaskStatus
    priority: TaskPriority
    priority_order: Int
    start_date: String
    due_date: String
    actual_start_date: String
    actual_end_date: String
    effort: Float
    progress: Float
    progress_type: TaskProgressType
    assignee_id: ID
    type_: String
    category: String
    tags: [String]
  }

  input UpdateTaskStatusInput {
    task_id: ID!
    status: TaskStatus!
  }

  input TaskOrderItem {
    task_id: ID!
    priority_order: Int!
  }

  input ReorderTasksInput {
    project_id: ID!
    tasks: [TaskOrderItem!]!
  }

  input CreateCommentInput {
    task_id: ID!
    content: String!
    parent_comment_id: ID
  }

  input CreatePlanInput {
    project_id: ID!
    name: String!
    description: String
    is_active: Boolean
    plan_data: String
  }

  input UpdatePlanInput {
    id: ID!
    name: String
    description: String
    is_active: Boolean
    plan_data: String
  }

  input RegisterInput {
    email: String!
    password: String!
    username: String
    full_name: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  extend type Query {
    project(project_id: ID!): Project
    projects: [Project!]!
    task(task_id: ID!): Task
    tasks(project_id: ID, assignee_id: ID, status: String): [Task!]!
    task_subtasks(task_id: ID!): [Task!]!
    comment(id: ID!): CommentResponse
    task_comments(task_id: ID!): [CommentResponse!]!
    get_project_plans(project_id: String!): [Plan!]!
    get_latest_project_plan(project_id: String!): Plan
    get_plan(id: String!): Plan
    project_members(project_id: ID!): [ProjectMember!]!
    my_project_role(project_id: ID!): String
    notifications: [Notification!]!
    notification_count: NotificationCount!
  }

  extend type Mutation {
    create_project(input: CreateProjectInput!): Project!
    update_project(input: UpdateProjectInput!): Project!
    invite_project_member(project_id: ID!, email: String!, role: String!): ProjectMember!
    add_project_member(input: AddProjectMemberInput!): ProjectMember!
    update_project_member(input: UpdateProjectMemberInput!): ProjectMember!
    update_multiple_members(project_id: ID!, updates: [MemberRoleUpdate!]!): UpdateMultipleMembersResult!
    remove_project_member(project_id: ID!, user_id: ID!): Boolean!
    create_task(input: CreateTaskInput!): Task!
    update_task(input: UpdateTaskInput!): Task!
    update_task_status(input: UpdateTaskStatusInput!): Task!
    update_task_effort(task_id: ID!, effort: Float!): Task!
    delete_task(task_id: ID!): Boolean!
    reorder_tasks(input: ReorderTasksInput!): Boolean!
    create_comment(input: CreateCommentInput!): CommentResponse!
    delete_comment(id: ID!): Boolean!
    create_plan(input: CreatePlanInput!): Plan!
    update_plan(input: UpdatePlanInput!): Plan!
    register(input: RegisterInput!): AuthResponse!
    login(input: LoginInput!): AuthResponse!
    mark_notification_read(notification_id: ID!): Boolean!
    mark_all_notifications_read(user_id: ID!): Boolean!
    register_fcm_token(token: String!): Boolean!
    update_member_position(project_id: ID!, user_id: ID!, position: String): ProjectMember!
  }
`;
