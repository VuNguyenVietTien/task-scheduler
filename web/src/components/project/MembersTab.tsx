import React, { useState, useEffect, useCallback } from 'react';
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
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchProjectMembers,
  addMemberToStore,
  updateMemberRoleInStore,
  updateMultipleMemberRolesInStore,
  removeMemberFromStore,
  removeMultipleMembersFromStore,
  addMemberByEmail,
  removeMember,
  removeMultipleProjectMembers,
  updateProjectMemberRole,
  updateMultipleProjectMemberRoles
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
import { GET_PROJECT_TASKS } from '@/graphql/queries/projectMembers';
import { toBackendRole, toFrontendRole } from '@/lib/utils';

export const MembersTab: React.FC<MembersTabProps> = ({ projectId }) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
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

  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [updatingMultipleRoles, setUpdatingMultipleRoles] = useState(false);
  const [updating, setUpdating] = useState(false);

  const dispatch = useAppDispatch();
  const { members, myRole, loading, error } = useAppSelector(state => state.members);

  const myUserId = members.find(m => m.user.email === authUser?.email)?.user.userId ?? '';

  useEffect(() => {
    dispatch(fetchProjectMembers(projectId));
  }, [dispatch, projectId]);

  const [localMembers, setLocalMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (members && members.length > 0) {
      setLocalMembers([...members]);
      console.log("Members data updated from Redux store:", members);
    }
  }, [members]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleToggleAllMembers = () => {
    if (selectedMembers.length === localMembers.filter(m => m.user.userId !== myUserId).length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(localMembers
        .filter(m => m.user.userId !== myUserId)
        .map(m => m.user.userId));
    }
  };

  const handleBulkUpdateRole = async () => {
    if (selectedMembers.length === 0) return;

    try {
      setUpdatingMultipleRoles(true);

      const updates = selectedMembers.map(userId => ({
        userId,
        role: toBackendRole(bulkEditRole)
      }));

      const changedUpdates = updates.filter(update => {
        const member = members.find(m => m.user.userId === update.userId);
        return member && toBackendRole(member.role) !== update.role;
      });

      if (changedUpdates.length === 0) {
        showNotification('info', t('members.noChanges'));
        setOpenBulkEditDialog(false);
        return;
      }

      const resultAction = await dispatch(
        updateMultipleProjectMemberRoles({
          projectId,
          updates: changedUpdates
        })
      );

      if (updateMultipleProjectMemberRoles.fulfilled.match(resultAction)) {
        setOpenBulkEditDialog(false);
        setSelectedMembers([]);
        showNotification('success', t('members.rolesUpdated', { count: changedUpdates.length }));
      } else {
        const errorMessage = resultAction.payload as string;
        showNotification('error', errorMessage || t('members.roleUpdateFailed'));
      }
    } catch (error) {
      console.error('Error updating member roles:', error);
      showNotification('error', t('members.roleUpdateFailed'));
    } finally {
      setUpdatingMultipleRoles(false);
    }
  };

  const handleTempRoleChange = (userId: string, newRole: MemberRole) => {
    const member = members.find(m => m.user.userId === userId);
    if (!member) return;

    if (member.role === newRole) {
      const newPendingChanges = {...pendingChanges};
      delete newPendingChanges[userId];
      setPendingChanges(newPendingChanges);
      setTimeout(() => setHasPendingChanges(Object.keys(newPendingChanges).length > 0), 0);
    } else {
      const newPendingChanges = {
        ...pendingChanges,
        [userId]: newRole
      };
      setPendingChanges(newPendingChanges);
      setTimeout(() => setHasPendingChanges(Object.keys(newPendingChanges).length > 0), 0);
    }
  };

  const handleSaveBulkChanges = async () => {
    try {
      setUpdating(true);

      const updatedMembers = Object.entries(pendingChanges).map(([userId, role]) => {
        return {
          userId,
          role: toBackendRole(role)
        } as MemberRoleUpdate;
      });

      if (updatedMembers.length === 0) {
        setUpdating(false);
        return;
      }

      const resultAction = await dispatch(
        updateMultipleProjectMemberRoles({
          projectId,
          updates: updatedMembers
        })
      );

      if (updateMultipleProjectMemberRoles.fulfilled.match(resultAction)) {
        setPendingChanges({});
        setHasPendingChanges(false);
        showNotification('success', t('members.rolesUpdated', { count: updatedMembers.length }));
      } else {
        const errorMessage = resultAction.payload as string;
        showNotification('error', errorMessage || t('members.roleUpdateFailed'));
      }
    } catch (error) {
      console.error('Error updating member roles:', error);
      showNotification('error', t('members.roleUpdateFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateMemberRole = async () => {
    if (!selectedMember) return;

    try {
      setUpdatingRole(true);

      const resultAction = await dispatch(
        updateProjectMemberRole({
          projectId,
          userId: selectedMember.user.userId,
          role: toBackendRole(selectedRole)
        })
      );

      if (updateProjectMemberRole.fulfilled.match(resultAction)) {
        setOpenEditDialog(false);
        showNotification('success', t('members.roleUpdated'));
      } else {
        const errorMessage = resultAction.payload as string;
        showNotification('error', errorMessage || t('members.roleUpdateSingleFailed'));
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      showNotification('error', t('members.roleUpdateSingleFailed'));
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleAddMember = async () => {
    try {
      setAddingMember(true);

      const resultAction = await dispatch(
        addMemberByEmail({
          projectId,
          email: newMemberEmail,
          role: toBackendRole(newMemberRole)
        })
      );

      if (addMemberByEmail.fulfilled.match(resultAction)) {
        setOpenAddDialog(false);
        setNewMemberEmail('');
        showNotification('success', t('members.memberAdded'));
        console.log('New member added to Redux store:', resultAction.payload);
      } else {
        const errorMessage = resultAction.payload as string;
        showNotification('error', errorMessage || t('members.memberAddFailed'));
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('error', t('members.memberAddFailed'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    try {
      setRemovingMember(true);

      const resultAction = await dispatch(
        removeMember({
          projectId,
          userId
        })
      );

      if (removeMember.fulfilled.match(resultAction)) {
        showNotification('success', t('members.memberRemoved'));
        console.log('Member removed from Redux store:', userId);
      } else {
        const errorMessage = resultAction.payload as string;
        showNotification('error', errorMessage || t('members.memberRemoveFailed'));
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showNotification('error', t('members.memberRemoveFailed'));
    } finally {
      setRemovingMember(false);
    }
  };

  const handleRemoveMultipleMembers = async () => {
    if (selectedMembers.length === 0) return;

    try {
      const memberIds = selectedMembers.map(userId => `member-${userId}`);

      const resultAction = await dispatch(
        removeMultipleProjectMembers({
          projectId,
          memberIds
        })
      );

      if (removeMultipleProjectMembers.fulfilled.match(resultAction)) {
        const { userIds } = resultAction.payload;
        const successCount = resultAction.payload.successCount;
        const failedCount = resultAction.payload.failedCount;

        setSelectedMembers([]);
        showNotification('success', t('members.membersRemoved', { count: successCount }));
        console.log('Members removed from Redux store:', userIds);

        if (failedCount > 0) {
          setTimeout(() => {
            showNotification('info', t('members.membersRemoveFailed', { count: failedCount }));
          }, 3000);
        }
      } else {
        const errorMessage = resultAction.payload as string;
        showNotification('error', errorMessage || t('members.membersRemoveAllFailed'));
      }
    } catch (error) {
      console.error('Error removing multiple members:', error);
      showNotification('error', t('members.membersRemoveAllFailed'));
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;
  if (error) return <div>{t('common.error')}: {typeof error === 'string' ? error : t('members.cannotLoadMembers')}</div>;

  const isAdmin = myRole === 'Manager';
  const hasBulkSelections = selectedMembers.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">{t('members.projectMembers')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {hasPendingChanges && isAdmin && (
            <Button
              variant="contained"
              color="success"
              startIcon={<SaveIcon />}
              onClick={handleSaveBulkChanges}
              disabled={updating}
            >
              {updating
                ? <CircularProgress size={24} color="inherit" />
                : t('members.saveChanges', { count: Object.keys(pendingChanges).length })}
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
                  : t('members.editSelected', { count: selectedMembers.length })}
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleRemoveMultipleMembers}
                disabled={removingMember}
              >
                {removingMember
                  ? <CircularProgress size={24} color="inherit" />
                  : t('members.deleteSelected', { count: selectedMembers.length })}
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
            {addingMember ? <CircularProgress size={24} color="inherit" /> : t('members.addMember')}
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
                    indeterminate={selectedMembers.length > 0 && selectedMembers.length < localMembers.filter(m => m.user.userId !== myUserId).length}
                    checked={selectedMembers.length === localMembers.filter(m => m.user.userId !== myUserId).length && localMembers.length > 1}
                    onChange={handleToggleAllMembers}
                    disabled={localMembers.length <= 1}
                  />
                </TableCell>
              )}
              <TableCell>{t('members.colUser')}</TableCell>
              <TableCell>{t('common.email')}</TableCell>
              <TableCell>{t('common.role')}</TableCell>
              <TableCell>{t('members.colJoinedAt')}</TableCell>
              {isAdmin && <TableCell align="right">{t('common.actions')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {localMembers.map((member) => (
              <TableRow
                key={member.user.userId}
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
                      <MenuItem value="Manager">Manager</MenuItem>
                      <MenuItem value="Leader">Leader</MenuItem>
                      <MenuItem value="Member">Member</MenuItem>
                      <MenuItem value="Guest">Guest</MenuItem>
                    </Select>
                  ) : (
                    member.role
                  )}
                </TableCell>
                <TableCell>
                  {new Date(member.joinedAt).toLocaleDateString()}
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

      {/* Add member dialog */}
      <Dialog open={openAddDialog} onClose={() => !addingMember && setOpenAddDialog(false)}>
        <DialogTitle>{t('members.addMemberTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('common.email')}
            type="email"
            fullWidth
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            disabled={addingMember}
          />
          <FormControl fullWidth margin="dense" disabled={addingMember}>
            <InputLabel>{t('common.role')}</InputLabel>
            <Select
              value={newMemberRole}
              onChange={(e: SelectChangeEvent<string>) =>
                setNewMemberRole(e.target.value as MemberRole)
              }
            >
              <MenuItem value="Manager">Manager</MenuItem>
              <MenuItem value="Leader">Leader</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Guest">Guest</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)} disabled={addingMember}>{t('common.cancel')}</Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            color="primary"
            disabled={addingMember || !newMemberEmail}
          >
            {addingMember ? <CircularProgress size={24} color="inherit" /> : t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog open={openEditDialog} onClose={() => !updatingRole && setOpenEditDialog(false)}>
        <DialogTitle>{t('members.editRoleTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {t('members.changeRoleFor', { name: selectedMember?.user.fullName || selectedMember?.user.username })}
          </Typography>
          <FormControl fullWidth margin="dense" disabled={updatingRole}>
            <InputLabel>{t('common.role')}</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e: SelectChangeEvent<string>) =>
                setSelectedRole(e.target.value as MemberRole)
              }
            >
              <MenuItem value="Manager">Manager</MenuItem>
              <MenuItem value="Leader">Leader</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Guest">Guest</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)} disabled={updatingRole}>{t('common.cancel')}</Button>
          <Button
            onClick={handleUpdateMemberRole}
            variant="contained"
            color="primary"
            disabled={updatingRole}
          >
            {updatingRole ? <CircularProgress size={24} color="inherit" /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk edit dialog */}
      <Dialog open={openBulkEditDialog} onClose={() => !updatingMultipleRoles && setOpenBulkEditDialog(false)}>
        <DialogTitle>{t('members.bulkEditTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {t('members.bulkChangeRoleFor', { count: selectedMembers.length })}
          </Typography>
          <FormControl fullWidth margin="dense" disabled={updatingMultipleRoles}>
            <InputLabel>{t('members.newRole')}</InputLabel>
            <Select
              value={bulkEditRole}
              onChange={(e: SelectChangeEvent<string>) =>
                setBulkEditRole(e.target.value as MemberRole)
              }
            >
              <MenuItem value="Manager">Manager</MenuItem>
              <MenuItem value="Leader">Leader</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Guest">Guest</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkEditDialog(false)} disabled={updatingMultipleRoles}>{t('common.cancel')}</Button>
          <Button
            onClick={handleBulkUpdateRole}
            variant="contained"
            color="primary"
            disabled={updatingMultipleRoles}
          >
            {updatingMultipleRoles ? <CircularProgress size={24} color="inherit" /> : t('members.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification */}
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
