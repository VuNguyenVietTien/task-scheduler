import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { GET_PROJECT_BY_ID } from '@/graphql/queries/project';
import { ProjectData } from '@/types/project';
import { Project } from '@/hooks/useProject';

interface ProjectState {
  project: Project | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  project: null,
  loading: false,
  error: null
};

// Async thunk để fetch project details
export const fetchProject = createAsyncThunk(
  'project/fetchProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_PROJECT_BY_ID,
        variables: { projectId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.project;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải thông tin dự án');
    }
  }
);

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    resetProject: (state) => {
      state.project = null;
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // fetchProject
    builder.addCase(fetchProject.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchProject.fulfilled, (state, action) => {
      state.loading = false;
      state.project = action.payload;
    });
    builder.addCase(fetchProject.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  }
});

export const { resetProject } = projectSlice.actions;
export default projectSlice.reducer; 