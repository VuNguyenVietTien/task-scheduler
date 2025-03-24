import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { GET_PROJECT_MEMBERS } from '@/graphql/queries/member';
import { ProjectMember } from '@/hooks/useProject';

interface MembersState {
  members: ProjectMember[];
  loading: boolean;
  error: string | null;
}

const initialState: MembersState = {
  members: [],
  loading: false,
  error: null
};

// Async thunk để fetch project members
export const fetchProjectMembers = createAsyncThunk(
  'members/fetchProjectMembers',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_PROJECT_MEMBERS,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.projectMembers;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải danh sách thành viên');
    }
  }
);

const membersSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    resetMembers: (state) => {
      state.members = [];
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // fetchProjectMembers
    builder.addCase(fetchProjectMembers.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchProjectMembers.fulfilled, (state, action) => {
      state.loading = false;
      state.members = action.payload;
    });
    builder.addCase(fetchProjectMembers.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  }
});

export const { resetMembers } = membersSlice.actions;
export default membersSlice.reducer; 