import { gql } from '@apollo/client';

export const PLAN_FIELDS = gql`
  fragment PlanFields on Plan {
    id
    project_id
    name
    description
    created_at
    updated_at
    is_active
    plan_data
  }
`;

export const GET_PROJECT_PLANS = gql`
  query GetProjectPlans($projectId: String!) {
    get_project_plans(project_id: $projectId) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const GET_LATEST_PROJECT_PLAN = gql`
  query GetLatestProjectPlan($projectId: String!) {
    get_latest_project_plan(project_id: $projectId) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const GET_PLAN_BY_ID = gql`
  query GetPlanById($id: String!) {
    get_plan(id: $id) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`; 