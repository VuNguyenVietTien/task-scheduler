import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
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
import { Plan, CreatePlanInput, UpdatePlanInput } from '@/types/plan';
import { RootState } from '../store';

// Define types for the slice state
interface PlansState {
  plans: Plan[];
  activePlan: Plan | null;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: PlansState = {
  plans: [],
  activePlan: null,
  loading: false,
  error: null
};

// Async thunks
export const fetchProjectPlans = createAsyncThunk(
  'plans/fetchProjectPlans',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const { data } = await client.query({
        query: GET_PROJECT_PLANS,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      return data.getProjectPlans;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch plans');
    }
  }
);

export const fetchLatestProjectPlan = createAsyncThunk(
  'plans/fetchLatestProjectPlan',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const { data } = await client.query({
        query: GET_LATEST_PROJECT_PLAN,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      return data.getLatestProjectPlan;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch latest plan');
    }
  }
);

export const createPlan = createAsyncThunk(
  'plans/createPlan',
  async (input: CreatePlanInput, { rejectWithValue }) => {
    try {
      const { data } = await client.mutate({
        mutation: CREATE_PLAN,
        variables: { input }
      });
      return data.createPlan;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create plan');
    }
  }
);

export const updatePlan = createAsyncThunk(
  'plans/updatePlan',
  async (input: UpdatePlanInput, { rejectWithValue }) => {
    try {
      const { data } = await client.mutate({
        mutation: UPDATE_PLAN,
        variables: { input }
      });
      return data.updatePlan;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update plan');
    }
  }
);

export const deletePlan = createAsyncThunk(
  'plans/deletePlan',
  async (id: string, { rejectWithValue }) => {
    try {
      const { data } = await client.mutate({
        mutation: DELETE_PLAN,
        variables: { id }
      });
      if (data.deletePlan) {
        return id;
      }
      return rejectWithValue('Failed to delete plan');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete plan');
    }
  }
);

export const setPlanActive = createAsyncThunk(
  'plans/setPlanActive',
  async (id: string, { rejectWithValue }) => {
    try {
      const { data } = await client.mutate({
        mutation: SET_PLAN_ACTIVE,
        variables: { id }
      });
      return data.setPlanActive;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to set plan active');
    }
  }
);

// Create the slice
const plansSlice = createSlice({
  name: 'plans',
  initialState,
  reducers: {
    setActivePlan: (state, action: PayloadAction<Plan | null>) => {
      state.activePlan = action.payload;
    },
    clearPlans: (state) => {
      state.plans = [];
      state.activePlan = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch project plans
      .addCase(fetchProjectPlans.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.plans = action.payload;
      })
      .addCase(fetchProjectPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch latest project plan
      .addCase(fetchLatestProjectPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLatestProjectPlan.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.activePlan = action.payload;
          // Update plan in plans array if it exists
          const index = state.plans.findIndex(p => p.id === action.payload.id);
          if (index >= 0) {
            state.plans[index] = action.payload;
          } else if (action.payload) {
            state.plans.push(action.payload);
          }
        }
      })
      .addCase(fetchLatestProjectPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create plan
      .addCase(createPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.plans.push(action.payload);
        state.activePlan = action.payload;
      })
      .addCase(createPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Update plan
      .addCase(updatePlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePlan.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.plans.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.plans[index] = action.payload;
        }
        if (state.activePlan && state.activePlan.id === action.payload.id) {
          state.activePlan = action.payload;
        }
      })
      .addCase(updatePlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Delete plan
      .addCase(deletePlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePlan.fulfilled, (state, action) => {
        state.loading = false;
        state.plans = state.plans.filter(p => p.id !== action.payload);
        if (state.activePlan && state.activePlan.id === action.payload) {
          state.activePlan = state.plans.length > 0 ? state.plans[0] : null;
        }
      })
      .addCase(deletePlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Set plan active
      .addCase(setPlanActive.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(setPlanActive.fulfilled, (state, action) => {
        state.loading = false;
        // Update the plan in the plans array
        const index = state.plans.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.plans[index] = action.payload;
        }
        // Set as active plan
        state.activePlan = action.payload;
        // Update is_active status for all plans
        state.plans = state.plans.map(p => ({
          ...p,
          is_active: p.id === action.payload.id
        }));
      })
      .addCase(setPlanActive.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

// Export actions and reducer
export const { setActivePlan, clearPlans } = plansSlice.actions;

// Export selector
export const selectPlans = (state: RootState) => state.plans.plans;
export const selectActivePlan = (state: RootState) => state.plans.activePlan;
export const selectPlansLoading = (state: RootState) => state.plans.loading;
export const selectPlansError = (state: RootState) => state.plans.error;

export default plansSlice.reducer; 