import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { GET_PROJECT_MEMBERS } from '@/graphql/queries/member';
import { ProjectMember } from '@/hooks/useProject';
import { MemberRole, Member } from '@/types/members';

interface MembersState {
  members: Member[];
  loading: boolean;
  error: string | null;
}

const initialState: MembersState = {
  members: [],
  loading: false,
  error: null,
};

// Async thunk để fetch members từ API
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
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải danh sách thành viên');
    }
  }
);

// Async thunk để xóa nhiều members cùng lúc
export const removeMultipleMembers = createAsyncThunk(
  'members/removeMultipleMembers',
  async ({ projectId, memberIds }: { projectId: string, memberIds: string[] }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberIds }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove members');
      }
      
      const data = await response.json();
      return { memberIds, data };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk để cập nhật vai trò của nhiều members cùng lúc
export const updateMultipleMemberRoles = createAsyncThunk(
  'members/updateMultipleMemberRoles',
  async (
    { projectId, updates }: { projectId: string, updates: { userId: string, role: MemberRole }[] }, 
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members/roles`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update member roles');
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const membersSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    // Thêm thành viên mới vào store
    addMemberToStore: (state, action: PayloadAction<Member>) => {
      state.members.push(action.payload);
    },
    
    // Cập nhật vai trò của thành viên trong store
    updateMemberRoleInStore: (state, action: PayloadAction<{ userId: string, role: MemberRole }>) => {
      const { userId, role } = action.payload;
      const memberIndex = state.members.findIndex(member => member.userId === userId);
      
      if (memberIndex !== -1) {
        state.members[memberIndex].role = role;
      }
    },
    
    // Cập nhật hàng loạt vai trò thành viên
    updateMultipleMemberRolesInStore: (state, action: PayloadAction<{ userId: string, role: MemberRole }[]>) => {
      const updates = action.payload;
      
      updates.forEach(update => {
        const { userId, role } = update;
        const memberIndex = state.members.findIndex(member => member.userId === userId);
        
        if (memberIndex !== -1) {
          state.members[memberIndex].role = role;
        }
      });
    },
    
    // Xóa thành viên khỏi store
    removeMemberFromStore: (state, action: PayloadAction<string>) => {
      state.members = state.members.filter(member => member.userId !== action.payload);
    },
    
    // Xóa nhiều thành viên khỏi store
    removeMultipleMembersFromStore: (state, action: PayloadAction<string[]>) => {
      const userIds = action.payload;
      state.members = state.members.filter(member => !userIds.includes(member.userId));
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectMembers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectMembers.fulfilled, (state, action) => {
        state.loading = false;
        state.members = action.payload;
      })
      .addCase(fetchProjectMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(removeMultipleMembers.fulfilled, (state, action) => {
        const { memberIds } = action.payload;
        state.members = state.members.filter(member => !memberIds.includes(member.userId));
      })
      .addCase(updateMultipleMemberRoles.fulfilled, (state, action) => {
        const updatedMembers = action.payload.members;
        
        updatedMembers.forEach((updated: { user: { userId: string }, role: MemberRole }) => {
          const memberIndex = state.members.findIndex(
            member => member.userId === updated.user.userId
          );
          
          if (memberIndex !== -1) {
            state.members[memberIndex].role = updated.role;
          }
        });
      });
  },
});

export const { 
  addMemberToStore, 
  updateMemberRoleInStore, 
  updateMultipleMemberRolesInStore,
  removeMemberFromStore,
  removeMultipleMembersFromStore
} = membersSlice.actions;

export default membersSlice.reducer; 