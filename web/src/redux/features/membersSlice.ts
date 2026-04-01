import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { GET_PROJECT_MEMBERS } from '@/graphql/queries/member';
import {
  INVITE_PROJECT_MEMBER,
  REMOVE_PROJECT_MEMBER,
  UPDATE_PROJECT_MEMBER_ROLE,
  UPDATE_MEMBER_POSITION,
} from '@/graphql/mutations/projectMember';
import { REMOVE_MULTIPLE_PROJECT_MEMBERS, UPDATE_MULTIPLE_MEMBER_ROLES } from '@/graphql/mutations/projectMembers';
import { ProjectMember } from '@/hooks/useProject';
import { MemberRole, Member } from '@/types/members';
import { toFrontendRole } from '@/lib/utils';

interface MembersState {
  members: Member[];
  myRole: MemberRole | null;
  loading: boolean;
  error: string | null;
}

const initialState: MembersState = {
  members: [],
  myRole: null,
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

      const rawMembers = response.data.project_members ?? [];
      const myRole = toFrontendRole(response.data.my_project_role ?? '');
      return {
        members: rawMembers.map((m: any) => ({
          memberId: `member-${m.user.user_id}`,
          userId: m.user.user_id,
          role: toFrontendRole(m.role),
          joinedAt: m.joined_at,
          position: m.position ?? null,
          user: {
            userId: m.user.user_id,
            email: m.user.email,
            username: m.user.username,
            fullName: m.user.full_name,
            avatarUrl: m.user.avatar_url,
          },
        })),
        myRole,
      };
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

// Async thunk để thêm thành viên qua email
export const addMemberByEmail = createAsyncThunk(
  'members/addMemberByEmail',
  async ({ 
    projectId, 
    email, 
    role 
  }: { 
    projectId: string, 
    email: string, 
    role: string 
  }, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: INVITE_PROJECT_MEMBER,
        variables: {
          project_id: projectId,
          email,
          role,
        }
      });

      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }

      // Chuyển đổi dữ liệu từ API sang định dạng Member
      const addedMember = response.data.invite_project_member;
      const newMember: Member = {
        memberId: `member-${addedMember.user.user_id}`,
        userId: addedMember.user.user_id,
        role: toFrontendRole(addedMember.role),
        joinedAt: addedMember.joined_at,
        position: addedMember.position ?? null,
        user: {
          userId: addedMember.user.user_id,
          email: addedMember.user.email,
          username: addedMember.user.username,
          fullName: addedMember.user.full_name,
          avatarUrl: addedMember.user.avatar_url
        }
      };
      
      return newMember;
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi thêm thành viên');
    }
  }
);

// Async thunk để xóa thành viên
export const removeMember = createAsyncThunk(
  'members/removeMember',
  async ({ 
    projectId, 
    userId 
  }: { 
    projectId: string, 
    userId: string 
  }, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: REMOVE_PROJECT_MEMBER,
        variables: {
          project_id: projectId,
          user_id: userId
        }
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      // Đảm bảo trả về đúng userId để xóa khỏi store
      return userId;
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi xóa thành viên');
    }
  }
);

// Async thunk để xóa nhiều thành viên sử dụng GraphQL
export const removeMultipleProjectMembers = createAsyncThunk(
  'members/removeMultipleProjectMembers',
  async ({ 
    projectId, 
    memberIds 
  }: { 
    projectId: string, 
    memberIds: string[] 
  }, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: REMOVE_MULTIPLE_PROJECT_MEMBERS,
        variables: { 
          projectId, 
          memberIds 
        }
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      // Trích xuất thông tin từ response
      const result = response.data.remove_multiple_project_members;

      // Trả về kết quả để cập nhật store
      return {
        userIds: memberIds.map(memberId => memberId.replace('member-', '')),
        successCount: result.success_count,
        failedCount: result.failed_count
      };
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi xóa nhiều thành viên');
    }
  }
);

// Async thunk để cập nhật vị trí của một thành viên
export const updateMemberPosition = createAsyncThunk(
  'members/updateMemberPosition',
  async ({ projectId, userId, position }: { projectId: string; userId: string; position: string | null }, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: UPDATE_MEMBER_POSITION,
        variables: { project_id: projectId, user_id: userId, position },
      });
      if (response.errors) return rejectWithValue(response.errors[0].message);
      return { userId, position };
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật vị trí thành viên');
    }
  }
);

// Async thunk để cập nhật vai trò của một thành viên
export const updateProjectMemberRole = createAsyncThunk(
  'members/updateProjectMemberRole',
  async ({ 
    projectId, 
    userId, 
    role 
  }: { 
    projectId: string, 
    userId: string, 
    role: string 
  }, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: UPDATE_PROJECT_MEMBER_ROLE,
        variables: {
          input: { project_id: projectId, user_id: userId, role }
        }
      });

      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }

      // Lấy thông tin từ response
      const updatedMember = response.data.update_project_member;
      
      // Trả về đối tượng cập nhật để cập nhật store
      return {
        userId,
        role: toFrontendRole(updatedMember.role)
      };
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật vai trò thành viên');
    }
  }
);

// Async thunk để cập nhật vai trò của nhiều thành viên sử dụng GraphQL
export const updateMultipleProjectMemberRoles = createAsyncThunk(
  'members/updateMultipleProjectMemberRoles',
  async ({ 
    projectId, 
    updates 
  }: { 
    projectId: string, 
    updates: { userId: string, role: string }[] 
  }, { rejectWithValue }) => {
    try {
      console.log('Sending updates to API:', updates); // Debug log
      
      const response = await client.mutate({
        mutation: UPDATE_MULTIPLE_MEMBER_ROLES,
        variables: { 
          projectId, 
          updates 
        }
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      // Lấy thông tin từ response
      const result = response.data.update_multiple_members;

      // Chuyển đổi dữ liệu từ response, giữ nguyên cấu trúc như updates gửi đi
      const updatedMembers = updates.map(update => ({
        userId: update.userId,
        role: toFrontendRole(
          result.members.find((m: any) => m.user.user_id === update.userId)?.role || update.role
        )
      }));

      // Trả về kết quả để cập nhật store
      return {
        members: updatedMembers,
        successCount: result.success_count
      };
    } catch (error: any) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi cập nhật vai trò nhiều thành viên');
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
        state.members = action.payload.members;
        state.myRole = action.payload.myRole;
      })
      .addCase(fetchProjectMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addMemberByEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addMemberByEmail.fulfilled, (state, action) => {
        state.loading = false;
        state.members.push(action.payload);
      })
      .addCase(addMemberByEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(removeMember.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeMember.fulfilled, (state, action) => {
        state.loading = false;
        state.members = state.members.filter(member => member.user.userId !== action.payload);
      })
      .addCase(removeMember.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(removeMultipleMembers.fulfilled, (state, action) => {
        const { memberIds } = action.payload;
        state.members = state.members.filter(member => !memberIds.includes(member.userId));
      })
      .addCase(updateMultipleMemberRoles.fulfilled, (state, action) => {
        state.loading = false;
        const { members: updatedMembers } = action.payload;
        
        console.log('Updating store with:', updatedMembers); // Debug log
        
        updatedMembers.forEach((update: { userId: string, role: MemberRole }) => {
          const memberIndex = state.members.findIndex(member => member.userId === update.userId);
          
          if (memberIndex !== -1) {
            console.log(`Updating member ${update.userId} role to ${update.role}`); // Debug log
            state.members[memberIndex].role = update.role;
          }
        });
      })
      .addCase(removeMultipleProjectMembers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeMultipleProjectMembers.fulfilled, (state, action) => {
        state.loading = false;
        const { userIds } = action.payload;
        state.members = state.members.filter(member => !userIds.includes(member.userId));
      })
      .addCase(removeMultipleProjectMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateProjectMemberRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProjectMemberRole.fulfilled, (state, action) => {
        state.loading = false;
        const { userId, role } = action.payload;
        const memberIndex = state.members.findIndex(member => member.userId === userId);
        
        if (memberIndex !== -1) {
          state.members[memberIndex].role = role;
        }
      })
      .addCase(updateProjectMemberRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateMultipleProjectMemberRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMultipleProjectMemberRoles.fulfilled, (state, action) => {
        state.loading = false;
        const { members } = action.payload;
        
        console.log('Updating store with:', members); // Debug log
        
        members.forEach((update: { userId: string, role: MemberRole }) => {
          const memberIndex = state.members.findIndex(member => member.user.userId === update.userId);
          
          if (memberIndex !== -1) {
            console.log(`Updating member ${update.userId} role to ${update.role}`); // Debug log
            state.members[memberIndex].role = update.role;
          } else {
            console.log(`Member not found for userId: ${update.userId}`); // Debug log
          }
        });
      })
      .addCase(updateMultipleProjectMemberRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateMemberPosition.fulfilled, (state, action) => {
        const { userId, position } = action.payload;
        const idx = state.members.findIndex(m => m.userId === userId);
        if (idx !== -1) state.members[idx].position = position;
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