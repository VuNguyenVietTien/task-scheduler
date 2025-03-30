import { gql } from '@apollo/client';

export const PLAN_FIELDS = gql`
  fragment PlanFields on Plan {
    id
    projectId
    name
    description
    createdBy
    createdAt
    updatedAt
    isActive
    planData
  }
`;

export const GET_PROJECT_PLANS = gql`
  query GetProjectPlans($projectId: String!) {
    getProjectPlans(projectId: $projectId) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const GET_LATEST_PROJECT_PLAN = gql`
  query GetLatestProjectPlan($projectId: String!) {
    getLatestProjectPlan(projectId: $projectId) {
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