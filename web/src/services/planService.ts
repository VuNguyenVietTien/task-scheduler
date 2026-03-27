import { client } from '@/apollo';
import { 
  GET_PROJECT_PLANS, 
  GET_LATEST_PROJECT_PLAN, 
  GET_PLAN_BY_ID
} from '@/graphql/queries/plans';
import { 
  CREATE_PLAN, 
  UPDATE_PLAN, 
  DELETE_PLAN, 
  SET_PLAN_ACTIVE 
} from '@/graphql/mutations/plans';
import { 
  Plan, 
  CreatePlanInput, 
  UpdatePlanInput 
} from '@/types/plan';

export const planService = {
  // Queries
  getProjectPlans: async (projectId: string): Promise<Plan[]> => {
    const { data } = await client.query({
      query: GET_PROJECT_PLANS,
      variables: { projectId },
      fetchPolicy: 'network-only'
    });
    return data.getProjectPlans;
  },

  getLatestProjectPlan: async (projectId: string): Promise<Plan | null> => {
    const { data } = await client.query({
      query: GET_LATEST_PROJECT_PLAN,
      variables: { projectId },
      fetchPolicy: 'network-only'
    });
    return data.getLatestProjectPlan;
  },

  getPlanById: async (id: string): Promise<Plan | null> => {
    const { data } = await client.query({
      query: GET_PLAN_BY_ID,
      variables: { id }
    });
    return data.getPlan;
  },

  // Mutations
  createPlan: async (input: CreatePlanInput): Promise<Plan> => {
    const { data } = await client.mutate({
      mutation: CREATE_PLAN,
      variables: { input }
    });
    return data.createPlan;
  },

  updatePlan: async (input: UpdatePlanInput): Promise<Plan> => {
    const { data } = await client.mutate({
      mutation: UPDATE_PLAN,
      variables: { input }
    });
    return data.updatePlan;
  },

  deletePlan: async (id: string): Promise<boolean> => {
    const { data } = await client.mutate({
      mutation: DELETE_PLAN,
      variables: { id }
    });
    return data.deletePlan;
  },

  setPlanActive: async (id: string): Promise<Plan> => {
    const { data } = await client.mutate({
      mutation: SET_PLAN_ACTIVE,
      variables: { id }
    });
    return data.setPlanActive;
  }
}; 