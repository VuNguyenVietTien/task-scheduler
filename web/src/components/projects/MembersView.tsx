'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@apollo/client';
import { UPDATE_PROJECT_MEMBER_ROLE, REMOVE_PROJECT_MEMBER } from '@/graphql/mutations/projectMember';
import { UPDATE_MULTIPLE_MEMBER_ROLES } from '@/graphql/mutations/projectMembers';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { MemberRole, Member as MemberType } from '@/types/members';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  updateMultipleMemberRolesInStore,
  updateMemberRoleInStore,
  addMemberByEmail,
  removeMember,
  updateMultipleProjectMemberRoles,
  updateMemberPosition,
} from '@/redux/features/membersSlice';
import { toBackendRole, toFrontendRole } from '@/lib/utils';
import { RootState } from '@/redux/store';
import { useTranslation } from 'react-i18next';

// Định nghĩa các type cần thiết
type Member = {
  role: string; // Role từ API
  joinedAt: string;
  position?: string | null;
  user: {
    userId: string;
    email: string;
    fullName: string;
    username: string;
    avatarUrl: string;
  };
};

type ProjectMembersProps = {
  projectId: string;
  members: Member[];
  currentUserRole: string;  // Role của người dùng hiện tại trong project
  refetch: () => void;
};

type AddMemberFormValues = {
  email: string;
  role: MemberRole;
  position?: string;
};

// Định nghĩa thêm kiểu dữ liệu cho API response
type UpdatedMember = {
  userId: string;
  role: string;
  memberId: string;
  projectId: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
};

type UpdateMultipleMembersResponse = {
  updateMultipleMembers: {
    successCount: number;
    members: UpdatedMember[];
  };
};

export function MembersView({ projectId, members: propMembers, currentUserRole, refetch }: ProjectMembersProps) {
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, MemberRole>>(new Map());
  const [pendingPositions, setPendingPositions] = useState<Map<string, string>>(new Map());
  const [addError, setAddError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Sử dụng Redux
  const dispatch = useAppDispatch();
  // Đăng ký theo dõi thay đổi từ Redux store
  const membersState = useAppSelector((state: RootState) => state.members);
  const { members: storeMembers, loading, error: storeError } = membersState;
  
  // State để lưu giá trị members hiển thị trên UI
  const [displayMembers, setDisplayMembers] = useState<Member[]>(propMembers);

  // Khởi tạo displayMembers ban đầu từ propMembers
  useEffect(() => {
    if (propMembers && propMembers.length > 0) {
      setDisplayMembers(propMembers);
    }
  }, []); // Chỉ chạy một lần khi component mount
  
  // Hook theo dõi thay đổi từ Redux store
  useEffect(() => {
    if (storeMembers && storeMembers.length > 0) {
      console.log('Members state changed:', storeMembers);
      setDisplayMembers(storeMembers.map(storeMember => ({
        role: storeMember.role,
        joinedAt: storeMember.joinedAt,
        position: storeMember.position ?? null,
        user: {
          userId: storeMember.user.userId,
          email: storeMember.user.email,
          fullName: storeMember.user.fullName || '',
          username: storeMember.user.username,
          avatarUrl: storeMember.user.avatarUrl || ''
        }
      })));
      console.log('Updated displayMembers with store data');
    }
  }, [storeMembers]); // Chỉ theo dõi storeMembers thay vì toàn bộ membersState

  // Hiển thị thông báo lỗi nếu có
  useEffect(() => {
    if (storeError) {
      toast.error(storeError);
    }
  }, [storeError]);

  // Chỉ Manager mới có quyền quản lý thành viên
  const canManageMembers = String(currentUserRole).toLowerCase() === 'manager';
  
  // Debug: Log vai trò hiện tại để kiểm tra
  useEffect(() => {
    console.log('MembersView - Thông tin quyền:');
    console.log('Vai trò trong dự án (raw):', currentUserRole);
    console.log('Vai trò trong dự án (type):', typeof currentUserRole);
    console.log('Vai trò trong dự án (toLowerCase):', typeof currentUserRole === 'string' ? currentUserRole.toLowerCase() : currentUserRole);
    console.log('So sánh currentUserRole === "admin":', currentUserRole === 'admin');
    console.log('So sánh String(currentUserRole).toLowerCase() === "admin":', String(currentUserRole).toLowerCase() === 'admin');
    console.log('Có quyền quản lý thành viên?', canManageMembers);
    
    // Kiểm tra members được truyền vào component
    console.log('===== CHI TIẾT MEMBERS =====');
    console.log('Members array:', propMembers);
    console.log('Members roles:', propMembers?.map(m => ({
      userId: m.user.userId,
      username: m.user.username || m.user.email,
      role: m.role,
      roleType: typeof m.role,
      roleValue: String(m.role),
      roleLowerCase: typeof m.role === 'string' ? m.role.toLowerCase() : String(m.role).toLowerCase(),
      isAdmin: ['manager', 'leader'].includes(String(m.role).toLowerCase()),
      isCurrentUser: false // Không còn sử dụng localStorage
    })));
  }, [currentUserRole, canManageMembers, propMembers]);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddMemberFormValues>({
    defaultValues: {
      email: '',
      role: 'Member'
    }
  });

  // Sử dụng mutations từ Apollo Client
  const [updateRole, { loading: updateLoading }] = useMutation(UPDATE_PROJECT_MEMBER_ROLE);
  const [updateMultipleRoles, { loading: updateMultipleLoading }] = useMutation(UPDATE_MULTIPLE_MEMBER_ROLES);
  
  // State để tracking loading state của các action từ Redux
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Xử lý thêm thành viên bằng Redux thunk
  const onAddMemberSubmit = async (data: AddMemberFormValues) => {
    if (!canManageMembers) {
      toast.error(t('members.noPermissionAdd'));
      return;
    }
    
    setAddError(null);
    setAddLoading(true);
    
    try {
      // Gọi Redux thunk thay vì mutation trực tiếp
      const resultAction = await dispatch(
        addMemberByEmail({
        projectId,
        email: data.email,
          role: toBackendRole(data.role)
        })
      );
      
      // Kiểm tra kết quả action
      if (addMemberByEmail.fulfilled.match(resultAction)) {
        // If position provided, update it after member is added
        const position = data.position?.trim();
        if (position) {
          const newMember = resultAction.payload as MemberType;
          await dispatch(updateMemberPosition({ projectId, userId: newMember.userId, position }));
        }
        toast.success(t('members.memberAddedSuccess'));
        setIsAddDialogOpen(false);
        reset();
        // Redux store đã cập nhật state, không cần gọi refetch
        // UI sẽ tự động cập nhật từ redux state
      } else {
        const errorMessage = resultAction.payload as string;
        if (errorMessage.includes("User with this email not found")) {
          setAddError(t('members.emailNotFound'));
        } else if (errorMessage.includes("User is already a member")) {
          setAddError(t('members.alreadyMember'));
        } else {
          setAddError(t('members.cannotAddMember'));
        }
      }
    } catch (error: any) {
      setAddError(error.message || t('members.errorAddingMember'));
    } finally {
      setAddLoading(false);
    }
  };

  // Xử lý thêm nhanh thành viên bằng Redux thunk
  const handleQuickAdd = async () => {
    if (!canManageMembers) {
      toast.error(t('members.noPermissionAdd'));
      return;
    }

    if (!emailInput.trim()) {
      toast.error(t('members.emailRequired'));
      return;
    }

    setAddError(null);
    setAddLoading(true);
    
    try {
      // Gọi Redux thunk thay vì mutation trực tiếp
      const resultAction = await dispatch(
        addMemberByEmail({
        projectId,
        email: emailInput,
          role: toBackendRole('Member' as MemberRole)
        })
      );
      
      // Kiểm tra kết quả action
      if (addMemberByEmail.fulfilled.match(resultAction)) {
        toast.success(t('members.memberAddedSuccess'));
        setEmailInput('');
        // Không cần gọi refetch vì Redux store đã được cập nhật
        // Component sẽ tự động cập nhật từ state
      } else {
        const errorMessage = resultAction.payload as string;
        if (errorMessage.includes("User with this email not found")) {
          setAddError(t('members.emailNotFound'));
        } else if (errorMessage.includes("User is already a member")) {
          setAddError(t('members.alreadyMember'));
        } else {
          setAddError(t('members.cannotAddMember'));
        }
      }
    } catch (error: any) {
      setAddError(error.message || t('members.errorAddingMember'));
    } finally {
      setAddLoading(false);
    }
  };

  // Xử lý xóa thành viên bằng Redux thunk
  const handleRemoveMember = async (userId: string) => {
    if (!canManageMembers) {
      toast.error(t('members.noPermissionRemove'));
      return;
    }

    // Không cho phép xóa chính mình khỏi dự án
    const currentUserId = localStorage.getItem('userId');
    if (userId === currentUserId) {
      toast.error(t('members.cannotRemoveSelf'));
      return;
    }

    if (confirm(t('members.confirmRemoveMember'))) {
      setRemoveLoading(true);
      
      try {
        // Gọi Redux thunk thay vì mutation trực tiếp
        const resultAction = await dispatch(
          removeMember({
            projectId,
            userId
          })
        );
        
        // Kiểm tra kết quả action
        if (removeMember.fulfilled.match(resultAction)) {
          toast.success(t('members.memberRemovedSuccess'));
          // Không cần gọi refetch vì Redux đã cập nhật state
          // UI sẽ tự động cập nhật nhờ useSelector và useEffect
        } else {
          const errorMessage = resultAction.payload as string;
          toast.error(errorMessage || t('members.cannotRemoveMemberError'));
        }
      } catch (error: any) {
        toast.error(error.message || t('members.errorRemovingMember'));
      } finally {
        setRemoveLoading(false);
      }
    }
  };

  // Xử lý khi người dùng thay đổi vai trò của thành viên
  const handleRoleChange = (userId: string, newRole: MemberRole) => {
    if (!canManageMembers) {
      toast.error(t('members.noPermissionEditRole'));
      return;
    }
    
    if (editMode) {
      // In edit mode, save changes to pending changes map
      const newChanges = new Map(pendingChanges);
      newChanges.set(userId, newRole as MemberRole);
      setPendingChanges(newChanges);
    } else {
      // In direct mode, apply change immediately
      // Chuyển đổi role sang lowercase cho backend
      updateRole({
        variables: {
          input: { project_id: projectId, user_id: userId, role: toBackendRole(newRole) }
        }
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!canManageMembers) return;
    if (pendingChanges.size === 0 && pendingPositions.size === 0) return;

    try {
      setUpdating(true);

      // Save role changes
      if (pendingChanges.size > 0) {
        const updates = Array.from(pendingChanges.entries()).map(([userId, role]) => ({
          userId,
          role: toBackendRole(role),
        }));

        const resultAction = await dispatch(updateMultipleProjectMemberRoles({ projectId, updates }));

        if (!updateMultipleProjectMemberRoles.fulfilled.match(resultAction)) {
          const errorMessage = resultAction.payload as string;
          toast.error(errorMessage || t('members.cannotUpdateRole'));
          return;
        }
      }

      // Save position changes
      const positionEntries = Array.from(pendingPositions.entries());
      for (const [userId, position] of positionEntries) {
        await dispatch(updateMemberPosition({ projectId, userId, position: position.trim() || null }));
      }

      toast.success(t('members.changesSavedSuccess'));
      setPendingChanges(new Map());
      setPendingPositions(new Map());
      setEditMode(false);
    } catch (error: any) {
      console.error('Failed to save changes:', error);
      toast.error(t('members.errorSavingChanges'));
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Kiểm tra vai trò thành viên
  const isAdminRole = (role: string): boolean => {
    if (!role) return false;
    return ['manager', 'leader'].includes(String(role).toLowerCase());
  };

  // Hàm chuyển đổi role thành dạng hiển thị
  const getRoleDisplay = (role: string): string => {
    if (!role) return 'Member';
    const mapping: Record<string, string> = {
      'manager': 'Manager',
      'leader': 'Leader',
      'member': 'Member',
      'guest': 'Guest',
      'admin': 'Manager',
      'viewer': 'Guest',
    };
    return mapping[role.toLowerCase()] || 'Member';
  };

  // Kiểm tra xem người dùng hiện tại có phải là chủ sở hữu dự án không
  const isCurrentUserProjectOwner = () => {
    return canManageMembers;
  };

  // Xử lý update role của member
  const handleRoleUpdate = async (userId: string, newRole: MemberRole) => {
    try {
      const { data } = await updateRole({
        variables: {
          input: { project_id: projectId, user_id: userId, role: toBackendRole(newRole) }
        },
        onError: (error) => {
          console.error('Error updating role:', error);
          setError(t('members.cannotUpdateRole'));
        }
      });

      if (data) {
        setSuccess(t('members.roleUpdateSuccess'));
        // Cập nhật redux store
        dispatch(updateMemberRoleInStore({
          userId,
          role: toFrontendRole(data.update_project_member.role) // Chuyển đổi về định dạng frontend
        }));
        // Khi cập nhật thành công, xóa khỏi pending changes
        const newChanges = new Map(pendingChanges);
        newChanges.delete(userId);
        setPendingChanges(newChanges);
        // UI sẽ tự động cập nhật từ redux state, không cần refetch
      }
    } catch (err) {
      console.error('Failed to update role:', err);
      setError(t('members.errorUpdatingRole'));
    }
  };

  // Xử lý cập nhật hàng loạt
  const handleBulkUpdate = async () => {
    try {
      // Chuyển các pendingChanges thành mảng updates
      const updates = Array.from(pendingChanges).map(([userId, role]) => ({
        userId,
        role: toBackendRole(role) // Chuyển về lowercase
      }));

      const { data } = await updateMultipleRoles({
        variables: {
          projectId,
          updates
        }
      });

      if (data) {
        setSuccess(t('members.rolesUpdatedSuccess', { count: data.update_multiple_members.success_count }));

        // Chuyển đổi dữ liệu từ API và đưa vào Redux
        const updatedRoles = data.update_multiple_members.members.map((member: any) => ({
          userId: member.user.user_id,
          role: toFrontendRole(member.role) // Chuyển từ backend về frontend
        }));
        
        dispatch(updateMultipleMemberRolesInStore(updatedRoles));
        
        // Xóa tất cả pending changes
        setPendingChanges(new Map());
        
        // Không cần refetch vì Redux đã cập nhật state
        // UI sẽ tự động cập nhật dựa trên redux state
      }
    } catch (err) {
      console.error('Failed to update roles:', err);
      setError(t('members.errorUpdatingRole'));
    }
  };

  // Xử lý lưu thay đổi vai trò của một thành viên
  const handleSaveRoleChange = async (userId: string) => {
    if (!canManageMembers) return;
    
    const newRole = pendingChanges.get(userId);
    if (!newRole) return;
    
    try {
      setUpdating(true);
      
      // Gọi mutation GraphQL để cập nhật vai trò
      const { data } = await updateRole({
        variables: {
          input: { project_id: projectId, user_id: userId, role: toBackendRole(newRole) }
        }
      });

      if (data) {
        // Cập nhật Redux store
        dispatch(updateMemberRoleInStore({
          userId,
          role: toFrontendRole(data.update_project_member.role) // Chuyển đổi dữ liệu trả về
        }));
        
        // Xóa khỏi pendingChanges
        const newChanges = new Map(pendingChanges);
        newChanges.delete(userId);
        setPendingChanges(newChanges);
        
        // Thông báo thành công
        setSuccess(t('members.roleUpdateSuccess'));
        
        // UI sẽ tự động cập nhật từ redux state, không cần refetch
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      setError(t('members.errorUpdatingRole'));
    } finally {
      setUpdating(false);
    }
  };

  // Xử lý lưu tất cả thay đổi vai trò
  const handleSaveAllChanges = async () => {
    if (!canManageMembers || pendingChanges.size === 0) return;
    
    try {
      setUpdating(true);
      
      // Chuyển đổi từ Map thành mảng updates
      const updates = Array.from(pendingChanges.entries()).map(([userId, role]) => ({
        userId,
        role: toBackendRole(role) // Chuyển đổi role thành lowercase
      }));
      
      // Gọi mutation để cập nhật hàng loạt
      const { data } = await updateMultipleRoles({
        variables: {
          projectId,
          updates
        }
      });
      
      if (data) {
        // Cập nhật Redux store
        const processedUpdates = data.update_multiple_members.members.map((member: any) => ({
          userId: member.user.user_id,
          role: toFrontendRole(member.role) // Chuyển đổi dữ liệu trả về
        }));

        dispatch(updateMultipleMemberRolesInStore(processedUpdates));

        // Xóa tất cả pendingChanges
        setPendingChanges(new Map());

        // Thông báo thành công
        setSuccess(t('members.rolesUpdatedSuccess', { count: data.update_multiple_members.success_count }));
        
        // Không cần refetch, UI sẽ tự động cập nhật từ redux state
      }
    } catch (error) {
      console.error('Failed to update roles:', error);
      setError(t('members.errorUpdatingRole'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('members.projectMembers')}</h2>
        {canManageMembers && (
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              onClick={() => setIsAddDialogOpen(true)}
            >
              {t('members.addMember')}
            </button>
            {editMode ? (
              <>
                <button
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition"
                  onClick={() => { setEditMode(false); setPendingChanges(new Map()); setPendingPositions(new Map()); }}
                  disabled={updating}
                >
                  {t('members.cancelEdit')}
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                  onClick={handleSaveChanges}
                  disabled={updating}
                >
                  {updating ? t('members.saving') : t('members.saveChanges')}
                </button>
              </>
            ) : (
              <button
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition"
                onClick={() => setEditMode(true)}
              >
                {t('members.editMode')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialog để thêm thành viên mới */}
      <Dialog 
        open={isAddDialogOpen} 
        onClose={() => {
          setIsAddDialogOpen(false);
          setAddError(null);
          reset();
        }}
        title={t('members.addMemberToProject')}
      >
        <form onSubmit={handleSubmit(onAddMemberSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">{t('members.emailLabel')}</label>
            <input
              id="email"
              type="email"
              {...register('email', { required: t('members.emailRequired') })}
              placeholder={t('members.emailInputPlaceholder')}
              className={`w-full px-3 py-2 border ${addError ? 'border-red-500' : 'border-gray-300'} rounded-md`}
            />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
            {addError && <p className="text-red-500 text-sm">{addError}</p>}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">{t('members.roleLabel')}</label>
            <select
              id="role"
              {...register('role')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="Manager">Manager</option>
              <option value="Leader">Leader</option>
              <option value="Member">Member</option>
              <option value="Guest">Guest</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="position" className="text-sm font-medium">{t('members.positionLabel')} <span className="text-gray-400 font-normal">{t('members.positionOptional')}</span></label>
            <input
              id="position"
              type="text"
              {...register('position')}
              placeholder={t('members.positionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md"
              onClick={() => {
                setIsAddDialogOpen(false);
                setAddError(null);
                reset();
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {addLoading ? t('members.addingMember') : t('members.addMember')}
            </button>
          </div>
        </form>
      </Dialog>
      
      {/* Form thêm nhanh thành viên */}
      {canManageMembers && (
        <div className="flex flex-col space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={t('members.emailPlaceholder')}
              className={`flex-1 px-3 py-2 border ${addError ? 'border-red-500' : 'border-gray-300'} rounded-md`}
            />
            <button
              onClick={handleQuickAdd}
              disabled={addLoading || !emailInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {addLoading ? t('members.addingMember') : t('members.quickAdd')}
            </button>
          </div>
          {addError && (
            <p className="text-red-500 text-sm">{addError}</p>
          )}
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('members.memberColumn')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('common.email')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('common.position')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('common.role')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('members.joinedAt')}
              </th>
              {canManageMembers && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('common.actions')}
              </th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayMembers.map((member: Member) => {
              // Sử dụng chuẩn hóa vai trò: chữ cái đầu viết hoa, còn lại viết thường
              const normalizedRole = member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase();
              
              // Kiểm tra có phải người dùng hiện tại không
              const isCurrentUser = false; // Sẽ được xác định từ thông tin project
              const canEditThisMember = canManageMembers;
              
              return (
                <tr key={member.user.userId} className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {member.user.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={member.user.fullName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {(member.user.fullName || member.user.username || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="font-medium">
                        {member.user.fullName || member.user.username}
                        {isCurrentUser && <span className="ml-2 text-xs text-blue-600">{t('members.youBadge')}</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {canManageMembers && editMode ? (
                      <input
                        type="text"
                        value={pendingPositions.has(member.user.userId) ? pendingPositions.get(member.user.userId) : (member.position || '')}
                        onChange={(e) => {
                          const newPositions = new Map(pendingPositions);
                          newPositions.set(member.user.userId, e.target.value);
                          setPendingPositions(newPositions);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 rounded-md w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder={t('members.positionInputPlaceholder')}
                        aria-label={t('common.position')}
                      />
                    ) : (
                      <span className="text-sm text-gray-700">
                        {member.position || <span className="text-gray-400 italic text-xs">{t('members.noPosition')}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {canManageMembers && editMode ? (
                      <select
                        value={pendingChanges.has(member.user.userId) ? pendingChanges.get(member.user.userId) : normalizedRole}
                        onChange={(e) => handleRoleChange(member.user.userId, e.target.value as MemberRole)}
                        className={`px-2 py-1 border border-gray-300 rounded-md ${
                          pendingChanges.has(member.user.userId) ? 'bg-yellow-50 border-yellow-300' : ''
                        }`}
                        aria-label={`${t('common.role')}: ${member.user.fullName || member.user.username}`}
                        disabled={!canEditThisMember}
                      >
                        <option value="Manager">Manager</option>
                        <option value="Leader">Leader</option>
                        <option value="Member">Member</option>
                        <option value="Guest">Guest</option>
                      </select>
                    ) : (
                      <span className={isAdminRole(member.role) ? 'font-medium text-blue-600' : ''}>
                        {getRoleDisplay(member.role)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatDate(member.joinedAt)}
                  </td>
                  {canManageMembers && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {!isAdminRole(member.role) && !isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member.user.userId)}
                          disabled={removeLoading}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`${t('members.removeMember')} ${member.user.fullName || member.user.username}`}
                        >
                          {t('members.removeMember')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 