import { useQuery } from '@apollo/client';
import { GET_USERS } from '@/graphql/queries/users';
import { AssignedUser } from '@/types/user';

interface GraphQLUser {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

interface UsersQueryResult {
  users: GraphQLUser[];
}

export function useUsers() {
  const { loading, error, data } = useQuery<UsersQueryResult>(GET_USERS);

  const users: AssignedUser[] = data?.users?.map((user: GraphQLUser) => ({
    id: user.userId,
    name: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.role
  })) || [];

  return {
    loading,
    error,
    data: users
  };
}