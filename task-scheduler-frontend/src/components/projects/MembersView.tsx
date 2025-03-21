'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@apollo/client';
import { ADD_PROJECT_MEMBER, UPDATE_PROJECT_MEMBER_ROLE, REMOVE_PROJECT_MEMBER } from '@/graphql/mutations/projectMember';
import { GET_PROJECT_BY_ID } from '@/graphql/queries/project';
import { Dialog } from '@/components/ui/Dialog';

// Định nghĩa các type cần thiết
type Member = {
  role: 'owner' | 'manager' | 'editor' | 'viewer';
  joinedAt: string;
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
  currentUserRole: string;
  refetch: () => void;
};

type AddMemberFormValues = {
  email: string;
  role: 'manager' | 'editor' | 'viewer';
};

export function MembersView({ projectId, members, currentUserRole, refetch }: ProjectMembersProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddMemberFormValues>({
    defaultValues: {
      email: '',
      role: 'viewer'
    }
  });

  // Mutation để thêm thành viên
  const [addMember, { loading: addLoading }] = useMutation(ADD_PROJECT_MEMBER, {
    refetchQueries: [
      { query: GET_PROJECT_BY_ID, variables: { projectId } },
    ],
    onCompleted: () => {
      alert('Member has been added to the project');
      setIsAddDialogOpen(false);
      reset();
    },
    onError: (error) => {
      alert(error.message || 'Unable to add member');
    }
  });

  // Mutation để cập nhật vai trò thành viên
  const [updateRole] = useMutation(UPDATE_PROJECT_MEMBER_ROLE, {
    refetchQueries: [
      { query: GET_PROJECT_BY_ID, variables: { projectId } },
    ],
    onCompleted: () => {
      alert('Member role has been updated');
    },
    onError: (error) => {
      alert(error.message || 'Unable to update role');
    }
  });

  // Mutation để xóa thành viên
  const [removeMember] = useMutation(REMOVE_PROJECT_MEMBER, {
    refetchQueries: [
      { query: GET_PROJECT_BY_ID, variables: { projectId } },
    ],
    onCompleted: () => {
      alert('Member has been removed from the project');
    },
    onError: (error) => {
      alert(error.message || 'Unable to remove member');
    }
  });

  const onAddMember = (data: AddMemberFormValues) => {
    addMember({
      variables: {
        projectId,
        email: data.email,
        role: data.role.toUpperCase()
      }
    });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRole({
      variables: {
        projectId,
        userId,
        role: newRole
      }
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      removeMember({
        variables: {
          projectId,
          userId
        }
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Project Members</h2>
        {isAdmin && (
          <>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              onClick={() => setIsAddDialogOpen(true)}
            >
              Add Member
            </button>
            
            <Dialog 
              open={isAddDialogOpen} 
              onClose={() => setIsAddDialogOpen(false)}
              title="Add Member to Project"
            >
              <form onSubmit={handleSubmit(onAddMember)} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <input
                    id="email"
                    type="email"
                    {...register('email', { required: 'Email is required' })}
                    placeholder="Enter member email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="role" className="text-sm font-medium">Role</label>
                  <select
                    id="role"
                    {...register('role')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="manager">Manager</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    {addLoading ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </Dialog>
          </>
        )}
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Join Date
              </th>
              {isAdmin && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.user.userId} className="hover:bg-gray-50">
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
                          {member.user.fullName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="font-medium">{member.user.fullName || member.user.username}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {member.user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {member.role === 'owner' ? (
                    <span className="font-medium text-blue-600">Owner</span>
                  ) : isAdmin ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user.userId, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md"
                      aria-label={`Change role of ${member.user.fullName || member.user.username}`}
                    >
                      <option value="manager">Manager</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span>
                      {member.role === 'manager' ? 'Manager' : 
                       member.role === 'editor' ? 'Editor' : 'Viewer'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {formatDate(member.joinedAt)}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.user.userId)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 