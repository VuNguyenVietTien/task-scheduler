import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useQuery, gql } from '@apollo/client';
import { usePathname } from 'next/navigation';
import { Task, ProjectTasksResponse } from '../../types/task';

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

export const TasksTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const pathname = usePathname();
  const { loading, error, data } = useQuery<ProjectTasksResponse>(GET_PROJECT_TASKS, {
    variables: { projectId },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const tasks = data?.projectTasks || [];

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Project Tasks
            </Typography>
            <Grid container spacing={2}>
              {tasks.map((task: Task) => (
                <Grid item xs={12} key={task.taskId}>
                  <Paper sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="subtitle1">{task.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {task.description}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Status
                            </Typography>
                            <Typography variant="body2">{task.status}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Priority
                            </Typography>
                            <Typography variant="body2">{task.priority}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Progress
                            </Typography>
                            <Typography variant="body2">{task.progress}%</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Due Date
                            </Typography>
                            <Typography variant="body2">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Assignee
                            </Typography>
                            <Typography variant="body2">
                              {task.assignee?.fullName || task.assignee?.username || 'Unassigned'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}; 