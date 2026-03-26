import { gql } from '@apollo/client';
import { PLAN_FIELDS } from '../queries/plans';

export const CREATE_PLAN = gql`
  mutation CreatePlan($input: CreatePlanInput!) {
    createPlan(input: $input) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const UPDATE_PLAN = gql`
  mutation UpdatePlan($input: UpdatePlanInput!) {
    updatePlan(input: $input) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`;

export const DELETE_PLAN = gql`
  mutation DeletePlan($id: String!) {
    deletePlan(id: $id)
  }
`;

export const SET_PLAN_ACTIVE = gql`
  mutation SetPlanActive($id: String!) {
    setPlanActive(id: $id) {
      ...PlanFields
    }
  }
  ${PLAN_FIELDS}
`; 