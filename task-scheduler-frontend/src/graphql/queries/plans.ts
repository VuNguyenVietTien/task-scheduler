import { gql } from '@apollo/client';

export const PLAN_FIELDS = gql`
  fragment PlanFields on Plan {
    id
    project_id
    name
    description
    created_by
    created_at
    updated_at
    is_active
    plan_data {
      tasks {
        task_id
        priority_order
        original_priority
        start_date
        end_date
      }
      metadata {
        last_sorted_date
        sort_criteria
      }
    }
  }
`;

export const GET_PROJECT_PLANS = gql`
  query GetProjectPlans($projectId: String!) {
    getProjectPlans(project_id: $projectId) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const GET_LATEST_PROJECT_PLAN = gql`
  query GetLatestProjectPlan($projectId: String!) {
    getLatestProjectPlan(project_id: $projectId) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const GET_PLAN_BY_ID = gql`
  query GetPlanById($id: String!) {
    getPlan(id: $id) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`; 