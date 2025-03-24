import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Typography,
  Box,
  SelectChangeEvent,
  CircularProgress,
  Snackbar,
  Alert,
  Checkbox,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon } from '@mui/icons-material';
import { useMutation } from '@apollo/client';
import { usePathname } from 'next/navigation';
import { Task, ProjectTasksResponse } from '../../types/task';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  fetchProjectMembers, 
  addMemberToStore, 
  updateMemberRoleInStore, 
  updateMultipleMemberRolesInStore,
  removeMemberFromStore,
  removeMultipleMembersFromStore
} from '@/redux/features/membersSlice';
import { ProjectMember } from '@/hooks/useProject';
import { 
  MemberRole, 
  Member, 
  MemberRoleUpdate, 
  MembersTabProps, 
  PendingChanges, 
  NotificationType
} from '@/types/members';
import {
  ADD_PROJECT_MEMBER,
  UPDATE_MEMBER_ROLE,
  UPDATE_PROJECT_MEMBER_ROLE,
  UPDATE_MULTIPLE_MEMBER_ROLES,
  REMOVE_PROJECT_MEMBER,
  REMOVE_MULTIPLE_PROJECT_MEMBERS
} from '@/graphql/mutations/projectMembers';
import { GET_PROJECT_TASKS } from '@/graphql/queries/projectMembers';

export const MembersTab: React.FC<MembersTabProps> = ({ projectId }) => {
  const pathname = usePathname();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openBulkEditDialog, setOpenBulkEditDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState<MemberRole>('Member');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('Member');
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkEditRole, setBulkEditRole] = useState<MemberRole>('Member');
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Sử dụng Redux
  const dispatch = useAppDispatch();
  const { members, loading, error } = useAppSelector(state => state.members);
  
  // Lấy userId của người dùng hiện tại
  const myUserId = localStorage.getItem('userId') || '';
  
  // Fetch members khi component được mount
  useEffect(() => {
    dispatch(fetchProjectMembers(projectId));
  }, [dispatch, projectId]);
  
  const [addMember, { loading: addingMember }] = useMutation(ADD_PROJECT_MEMBER);
  const [updateMemberRole, { loading: updatingRole }] = useMutation(UPDATE_MEMBER_ROLE);
  const [updateProjectMemberRole, { loading: updatingProjectRole }] = useMutation(UPDATE_PROJECT_MEMBER_ROLE);
  const [updateMultipleMemberRoles, { loading: updatingMultipleRoles }] = useMutation(UPDATE_MULTIPLE_MEMBER_ROLES);
  const [removeMember, { loading: removingMember }] = useMutation(REMOVE_PROJECT_MEMBER);
  const [removeMultipleMembers, { loading: removingMultipleMembers }] = useMutation(REMOVE_MULTIPLE_PROJECT_MEMBERS);

  // Hiển thị thông báo
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  // Đóng thông báo
  const handleCloseNotification = () => {
    setNotification(null);
  };

  // Xử lý chọn/bỏ chọn member
  const handleToggleMember = (userId: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Xử lý chọn tất cả/bỏ chọn tất cả
  const handleToggleAllMembers = () => {
    if (selectedMembers.length === members.filter(m => m.user.userId !== myUserId).length) {
      // Nếu đã chọn tất cả, bỏ chọn tất cả
      setSelectedMembers([]);
    } else {
      // Chọn tất cả (trừ user hiện tại)
      setSelectedMembers(members
        .filter(m => m.user.userId !== myUserId)
        .map(m => m.user.userId));
    }
  };

  // Xử lý cập nhật hàng loạt role của các thành viên
  const handleBulkUpdateRole = async () => {
    // Nếu không có thành viên nào được chọn thì không làm gì cả
    if (selectedMembers.length === 0) return;

    try {
      // Chuyển role sang chữ hoa đầu tiên
      const capitalizedRole = bulkEditRole.charAt(0).toUpperCase() + bulkEditRole.slice(1).toLowerCase();
      
      // Tạo danh sách updates chỉ với những thành viên được chọn
      const updates = selectedMembers.map(userId => ({
        userId,
        role: capitalizedRole // Đảm bảo role có chữ cái đầu viết hoa
      }));

      // Chỉ cập nhật những thành viên có vai trò khác với hiện tại
      const changedUpdates = updates.filter(update => {
        const member = members.find(m => m.user.userId === update.userId);
        return member && member.role !== update.role;
      });

      // Nếu không có thay đổi, hiển thị thông báo và thoát
      if (changedUpdates.length === 0) {
        showNotification('info', 'Không có thay đổi nào để cập nhật');
        setOpenBulkEditDialog(false);
        return;
      }

      // Gọi API batch update với chỉ những thành viên thay đổi
      const { data } = await updateMultipleMemberRoles({
        variables: {
          projectId,
          updates: changedUpdates
        }
      });

      // Cập nhật Redux store
      if (data?.updateMultipleMembers?.members) {
        const updatedMembers = data.updateMultipleMembers.members.map((member: any) => ({
          userId: member.user.userId,
          role: member.role
        }));
        
        dispatch(updateMultipleMemberRolesInStore(updatedMembers));
      }

      setOpenBulkEditDialog(false);
      setSelectedMembers([]);
      showNotification('success', `Đã cập nhật vai trò cho ${changedUpdates.length} thành viên`);
    } catch (error) {
      console.error('Error updating member roles:', error);
      showNotification('error', 'Không thể cập nhật vai trò thành viên. Vui lòng thử lại.');
    }
  };

  // Thêm hàm để thay đổi role tạm thời (chưa lưu vào DB)
  const handleTempRoleChange = (userId: string, newRole: MemberRole) => {
    // Tìm member hiện tại để kiểm tra xem có thay đổi không
    const member = members.find(m => m.user.userId === userId);
    if (!member) return;

    // Nếu role mới giống với role hiện tại, xóa khỏi pending changes
    if (member.role === newRole) {
      const newPendingChanges = {...pendingChanges};
      delete newPendingChanges[userId];
      setPendingChanges(newPendingChanges);
      // Cập nhật trạng thái sau khi thay đổi pendingChanges
      setTimeout(() => setHasPendingChanges(Object.keys(newPendingChanges).length > 0), 0);
    } else {
      // Nếu khác, thêm vào pending changes
      const newPendingChanges = {
        ...pendingChanges,
        [userId]: newRole
      };
      setPendingChanges(newPendingChanges);
      // Cập nhật trạng thái sau khi thay đổi pendingChanges
      setTimeout(() => setHasPendingChanges(Object.keys(newPendingChanges).length > 0), 0);
    }
  };

  // Thêm hàm để lưu tất cả thay đổi đang chờ
  const handleSaveBulkChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      // Lưu số lượng thay đổi để hiển thị trong thông báo
      const changeCount = Object.keys(pendingChanges).length;
      
      // Tạo mảng updates từ pendingChanges
      const updates = Object.entries(pendingChanges).map(([userId, role]) => {
        // Chuyển đổi role từ chữ thường sang chữ hoa đầu tiên
        const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
        return {
          userId: userId,
          role: capitalizedRole // Đảm bảo role có chữ cái đầu viết hoa
        } as MemberRoleUpdate;
      });
      
      // Gọi mutation để cập nhật tất cả các role
      const { data } = await updateMultipleMemberRoles({
        variables: {
          projectId,
          updates
        }
      });
      
      // Cập nhật Redux store
      const updatedMembers = data.updateMultipleMembers.members.map((member: any) => ({
        userId: member.user.userId,
        role: member.role
      }));
      
      dispatch(updateMultipleMemberRolesInStore(updatedMembers));

      // Xóa tất cả pending changes
      setPendingChanges({});
      setHasPendingChanges(false);
      
      // Chỉ hiển thị một thông báo duy nhất
      showNotification('success', `Đã cập nhật vai trò cho ${changeCount} thành viên`);
    } catch (error) {
      console.error('Error saving bulk changes:', error);
      showNotification('error', 'Không thể lưu thay đổi. Vui lòng thử lại.');
    }
  };

  const handleAddMember = async () => {
    try {
      const { data } = await addMember({
        variables: {
          projectId,
          input: {
            email: newMemberEmail,
            role: newMemberRole,
          },
        },
        update: (cache, { data }) => {
          // Cập nhật cache cho danh sách task
          const existingTasks = cache.readQuery<ProjectTasksResponse>({
            query: GET_PROJECT_TASKS,
            variables: { projectId },
          });
          if (existingTasks) {
            cache.writeQuery({
              query: GET_PROJECT_TASKS,
              variables: { projectId },
              data: {
                projectTasks: existingTasks.projectTasks.map((task: Task) => ({
                  ...task,
                  assignee: task.assignee_id === data.addProjectMember.userId ? data.addProjectMember.user : task.assignee,
                })),
              },
            });
          }
        },
      });
      
      // Chuyển đổi dữ liệu từ API sang định dạng Member
      const newMember: Member = {
        memberId: `member-${data.addProjectMember.userId}`,
        userId: data.addProjectMember.userId,
        role: data.addProjectMember.role,
        joinedAt: data.addProjectMember.joinedAt,
        user: {
          userId: data.addProjectMember.user.id,
          email: data.addProjectMember.user.email,
          username: data.addProjectMember.user.username, 
          fullName: data.addProjectMember.user.fullName,
          avatarUrl: data.addProjectMember.user.avatarUrl
        }
      };
      
      // Cập nhật Redux store trực tiếp
      dispatch(addMemberToStore(newMember));
      
      setOpenAddDialog(false);
      setNewMemberEmail('');
      showNotification('success', 'Thêm thành viên thành công');
      
      // Không cần fetch lại dữ liệu từ server vì đã cập nhật Redux store
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('error', 'Không thể thêm thành viên. Vui lòng thử lại.');
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedMember) return;
    try {
      // Chuyển đổi role từ chữ thường sang chữ hoa đầu tiên
      const capitalizedRole = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1).toLowerCase();
      
      // Sử dụng mutation mới
      const { data } = await updateProjectMemberRole({
        variables: {
          projectId,
          userId: selectedMember.user.userId,
          role: capitalizedRole,
        },
      });
      
      if (data?.updateProjectMember) {
        // Cập nhật Redux store trực tiếp 
        dispatch(updateMemberRoleInStore({
          userId: selectedMember.user.userId,
          role: data.updateProjectMember.role
        }));
        
      setOpenEditDialog(false);
      setSelectedMember(null);
        showNotification('success', 'Cập nhật vai trò thành công');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showNotification('error', 'Không thể cập nhật vai trò. Vui lòng thử lại.');
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    try {
      const { data } = await removeMember({
        variables: {
          projectId,
          memberId,
        },
        update: (cache) => {
          // Cập nhật cache cho danh sách task
          const existingTasks = cache.readQuery<ProjectTasksResponse>({
            query: GET_PROJECT_TASKS,
            variables: { projectId },
          });
          if (existingTasks) {
            cache.writeQuery({
              query: GET_PROJECT_TASKS,
              variables: { projectId },
              data: {
                projectTasks: existingTasks.projectTasks.map((task: Task) => ({
                  ...task,
                  assignee: task.assignee_id === data.removeProjectMember ? null : task.assignee,
                })),
              },
            });
          }
        },
      });
      
      // Cập nhật Redux store trực tiếp
      dispatch(removeMemberFromStore(userId));
      showNotification('success', 'Xóa thành viên thành công');
      
      // Không cần fetch lại dữ liệu từ server vì đã cập nhật Redux store
    } catch (error) {
      console.error('Error removing member:', error);
      showNotification('error', 'Không thể xóa thành viên. Vui lòng thử lại.');
    }
  };

  // Thêm hàm xóa nhiều member cùng lúc
  const handleRemoveMultipleMembers = async () => {
    if (selectedMembers.length === 0) return;

    try {
      // Chuyển đổi từ userId sang memberId
      const memberIds = selectedMembers.map(userId => `member-${userId}`);
      
      // Gọi mutation xóa hàng loạt
      const { data } = await removeMultipleMembers({
        variables: {
          projectId,
          memberIds,
        },
      });
      
      if (data && data.removeMultipleProjectMembers) {
        // Cập nhật Redux store
        dispatch(removeMultipleMembersFromStore(selectedMembers));
        
        // Xóa danh sách selected
        setSelectedMembers([]);
        
        showNotification(
          'success', 
          `Đã xóa ${data.removeMultipleProjectMembers.successCount} thành viên thành công`
        );
        
        if (data.removeMultipleProjectMembers.failedCount > 0) {
          setTimeout(() => {
            showNotification(
              'info', 
              `Không thể xóa ${data.removeMultipleProjectMembers.failedCount} thành viên`
            );
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error removing multiple members:', error);
      showNotification('error', 'Không thể xóa các thành viên. Vui lòng thử lại.');
    }
  };

  if (loading) return <div>Đang tải...</div>;
  if (error) return <div>Lỗi: {typeof error === 'string' ? error : 'Không thể tải dữ liệu thành viên'}</div>;

  // Xác định vai trò của người dùng trong dự án
  let myProjectRole = '';
  const currentUserMember = members.find(member => member.user.userId === myUserId);
  if (currentUserMember) {
    myProjectRole = currentUserMember.role;
  } else if (localStorage.getItem('userRole') === 'Admin' || localStorage.getItem('userRole') === 'SuperAdmin') {
    myProjectRole = 'Admin'; // Hệ thống Admin luôn có quyền Admin trong dự án
  }
  
  const isAdmin = myProjectRole === 'Admin';
  const hasBulkSelections = selectedMembers.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Thành viên dự án</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {hasPendingChanges && isAdmin && (
            <Button
              variant="contained"
              color="success"
              startIcon={<SaveIcon />}
              onClick={handleSaveBulkChanges}
              disabled={updatingMultipleRoles}
            >
              {updatingMultipleRoles 
                ? <CircularProgress size={24} color="inherit" /> 
                : `Lưu thay đổi (${Object.keys(pendingChanges).length})`}
            </Button>
          )}
          {hasBulkSelections && isAdmin && (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setOpenBulkEditDialog(true)}
                disabled={updatingMultipleRoles}
              >
                {updatingMultipleRoles 
                  ? <CircularProgress size={24} color="inherit" /> 
                  : `Sửa ${selectedMembers.length} thành viên`}
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleRemoveMultipleMembers}
                disabled={updatingMultipleRoles || removingMultipleMembers}
              >
                {removingMultipleMembers
                  ? <CircularProgress size={24} color="inherit" />
                  : `Xóa ${selectedMembers.length} thành viên`}
              </Button>
            </>
          )}
        {isAdmin && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenAddDialog(true)}
              disabled={addingMember}
          >
              {addingMember ? <CircularProgress size={24} color="inherit" /> : 'Thêm thành viên'}
          </Button>
        )}
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {isAdmin && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedMembers.length > 0 && selectedMembers.length < members.filter(m => m.user.userId !== myUserId).length}
                    checked={selectedMembers.length === members.filter(m => m.user.userId !== myUserId).length && members.length > 1}
                    onChange={handleToggleAllMembers}
                    disabled={members.length <= 1}
                  />
                </TableCell>
              )}
              <TableCell>Người dùng</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Tham gia từ</TableCell>
              {isAdmin && <TableCell align="right">Thao tác</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow 
                key={member.user.userId}
                // Đánh dấu hàng có thay đổi đang chờ
                sx={pendingChanges[member.user.userId] ? { backgroundColor: 'rgba(0, 128, 0, 0.05)' } : {}}
              >
                {isAdmin && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedMembers.includes(member.user.userId)}
                      onChange={() => handleToggleMember(member.user.userId)}
                      disabled={member.user.userId === myUserId}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.username}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          marginRight: 8,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          backgroundColor: '#e0e0e0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                        }}
                      >
                        {member.user.fullName?.[0] || member.user.username?.[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <Typography variant="body1">
                  {member.user.fullName || member.user.username}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        @{member.user.username}
                      </Typography>
                    </div>
                  </Box>
                </TableCell>
                <TableCell>{member.user.email}</TableCell>
                <TableCell>
                  {isAdmin && member.user.userId !== myUserId ? (
                    <Select
                      value={pendingChanges[member.user.userId] || member.role}
                      onChange={(e) => handleTempRoleChange(
                        member.user.userId, 
                        e.target.value as MemberRole
                      )}
                      size="small"
                      sx={{ minWidth: 100 }}
                    >
                      <MenuItem value="Admin">Admin</MenuItem>
                      <MenuItem value="Member">Member</MenuItem>
                      <MenuItem value="Viewer">Viewer</MenuItem>
                    </Select>
                  ) : (
                    member.role
                  )}
                </TableCell>
                <TableCell>
                  {new Date(member.joinedAt).toLocaleDateString('vi-VN')}
                </TableCell>
                {isAdmin && (
                  <TableCell align="right">
                    <IconButton
                      onClick={() => {
                        setSelectedMember({
                          memberId: `member-${member.user.userId}`,
                          userId: member.user.userId,
                          role: member.role as MemberRole,
                          joinedAt: member.joinedAt,
                          user: member.user
                        });
                        setSelectedRole(member.role as MemberRole);
                        setOpenEditDialog(true);
                      }}
                      disabled={member.user.userId === myUserId || updatingRole}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleRemoveMember(`member-${member.user.userId}`, member.user.userId)}
                      disabled={member.user.userId === myUserId || removingMember}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog thêm thành viên */}
      <Dialog open={openAddDialog} onClose={() => !addingMember && setOpenAddDialog(false)}>
        <DialogTitle>Thêm thành viên</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            disabled={addingMember}
          />
          <FormControl fullWidth margin="dense" disabled={addingMember}>
            <InputLabel>Vai trò</InputLabel>
            <Select
              value={newMemberRole}
              onChange={(e: SelectChangeEvent<string>) =>
                setNewMemberRole(e.target.value as MemberRole)
              }
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)} disabled={addingMember}>Hủy</Button>
          <Button 
            onClick={handleAddMember} 
            variant="contained" 
            color="primary"
            disabled={addingMember || !newMemberEmail}
          >
            {addingMember ? <CircularProgress size={24} color="inherit" /> : 'Thêm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog chỉnh sửa vai trò */}
      <Dialog open={openEditDialog} onClose={() => !updatingProjectRole && setOpenEditDialog(false)}>
        <DialogTitle>Chỉnh sửa vai trò</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Thay đổi vai trò cho {selectedMember?.user.fullName || selectedMember?.user.username}
          </Typography>
          <FormControl fullWidth margin="dense" disabled={updatingProjectRole}>
            <InputLabel>Vai trò</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e: SelectChangeEvent<string>) =>
                setSelectedRole(e.target.value as MemberRole)
              }
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)} disabled={updatingProjectRole}>Hủy</Button>
          <Button 
            onClick={handleUpdateRole} 
            variant="contained" 
            color="primary"
            disabled={updatingProjectRole}
          >
            {updatingProjectRole ? <CircularProgress size={24} color="inherit" /> : 'Lưu thay đổi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog chỉnh sửa hàng loạt */}
      <Dialog open={openBulkEditDialog} onClose={() => !updatingMultipleRoles && setOpenBulkEditDialog(false)}>
        <DialogTitle>Chỉnh sửa hàng loạt</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Thay đổi vai trò cho {selectedMembers.length} thành viên
          </Typography>
          <FormControl fullWidth margin="dense" disabled={updatingMultipleRoles}>
            <InputLabel>Vai trò mới</InputLabel>
            <Select
              value={bulkEditRole}
              onChange={(e: SelectChangeEvent<string>) =>
                setBulkEditRole(e.target.value as MemberRole)
              }
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkEditDialog(false)} disabled={updatingMultipleRoles}>Hủy</Button>
          <Button 
            onClick={handleBulkUpdateRole} 
            variant="contained" 
            color="primary"
            disabled={updatingMultipleRoles}
          >
            {updatingMultipleRoles ? <CircularProgress size={24} color="inherit" /> : 'Cập nhật'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Thông báo */}
      <Snackbar 
        open={notification !== null} 
        autoHideDuration={3000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification?.type || 'info'} 
          sx={{ width: '100%' }}
        >
          {notification?.message || ''}
        </Alert>
      </Snackbar>
    </Box>
  );
}; 