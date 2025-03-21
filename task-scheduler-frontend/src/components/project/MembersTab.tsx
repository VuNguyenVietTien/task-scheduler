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
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { Task, ProjectTasksResponse } from '../../types/task';

const GET_PROJECT_MEMBERS = gql`
  query GetProjectMembers($projectId: ID!) {
    projectMembers(projectId: $projectId) {
      memberId
      userId
      role
      joinedAt
      user {
        id
        email
        username
        fullName
        avatarUrl
      }
    }
    myProjectRole(projectId: $projectId)
  }
`;

const ADD_PROJECT_MEMBER = gql`
  mutation AddProjectMember($projectId: ID!, $input: AddMemberInput!) {
    addProjectMember(projectId: $projectId, input: $input) {
      memberId
      userId
      role
      joinedAt
      user {
        id
        email
        username
        fullName
        avatarUrl
      }
    }
  }
`;

const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($projectId: ID!, $input: UpdateMemberRoleInput!) {
    updateMemberRole(projectId: $projectId, input: $input) {
      memberId
      userId
      role
      joinedAt
      user {
        id
        email
        username
        fullName
        avatarUrl
      }
    }
  }
`;

const REMOVE_PROJECT_MEMBER = gql`
  mutation RemoveProjectMember($projectId: ID!, $memberId: ID!) {
    removeProjectMember(projectId: $projectId, memberId: $memberId)
  }
`;

const GET_PROJECT_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    projectTasks(projectId: $projectId) {
      taskId
      title
      description
      status
      priority
      startDate
      dueDate
      progress
      assignee {
        id
        username
        fullName
        avatarUrl
      }
      createdAt
      updatedAt
    }
  }
`;

interface Member {
  memberId: string;
  userId: string;
  role: 'Admin' | 'Member' | 'Viewer';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

export const MembersTab: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Admin' | 'Member' | 'Viewer'>('Member');

  const { loading, error, data, refetch } = useQuery(GET_PROJECT_MEMBERS, {
    variables: { projectId },
  });

  const [addMember] = useMutation(ADD_PROJECT_MEMBER);
  const [updateMemberRole] = useMutation(UPDATE_MEMBER_ROLE);
  const [removeMember] = useMutation(REMOVE_PROJECT_MEMBER);

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
                  assignee: task.assigneeId === data.addProjectMember.userId ? data.addProjectMember.user : task.assignee,
                })),
              },
            });
          }
        },
      });
      setOpenAddDialog(false);
      setNewMemberEmail('');
      refetch();
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleUpdateRole = async (role: 'Admin' | 'Member' | 'Viewer') => {
    if (!selectedMember) return;
    try {
      await updateMemberRole({
        variables: {
          projectId,
          input: {
            memberId: selectedMember.memberId,
            role,
          },
        },
      });
      setOpenEditDialog(false);
      setSelectedMember(null);
      refetch();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
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
                  assignee: task.assigneeId === data.removeProjectMember ? null : task.assignee,
                })),
              },
            });
          }
        },
      });
      refetch();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const isAdmin = data?.myProjectRole === 'Admin';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Project Members</Typography>
        {isAdmin && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenAddDialog(true)}
          >
            Add Member
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined At</TableCell>
              {isAdmin && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.projectMembers.map((member: Member) => (
              <TableRow key={member.memberId}>
                <TableCell>
                  {member.user.fullName || member.user.username}
                </TableCell>
                <TableCell>{member.user.email}</TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>
                  {new Date(member.joinedAt).toLocaleDateString()}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <IconButton
                      onClick={() => {
                        setSelectedMember(member);
                        setOpenEditDialog(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleRemoveMember(member.memberId)}
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

      {/* Add Member Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Add New Member</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            fullWidth
            value={newMemberEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMemberEmail(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Role</InputLabel>
            <Select
              value={newMemberRole}
              onChange={(e: SelectChangeEvent<'Admin' | 'Member' | 'Viewer'>) => 
                setNewMemberRole(e.target.value as 'Admin' | 'Member' | 'Viewer')
              }
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddMember} color="primary">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>Update Member Role</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedMember?.role || 'Member'}
              onChange={(e: SelectChangeEvent<'Admin' | 'Member' | 'Viewer'>) => 
                handleUpdateRole(e.target.value as 'Admin' | 'Member' | 'Viewer')
              }
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
              <MenuItem value="Viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 