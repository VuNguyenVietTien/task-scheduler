import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useQuery, gql } from '@apollo/client';
import { usePathname } from 'next/navigation';

interface ProjectOverview {
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  priority: string;
  visibility: string;
  progress: number;
  startDate: string;
  endDate: string;
  owner: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

interface ProjectOverviewResponse {
  project: ProjectOverview;
}

const GET_PROJECT_OVERVIEW = gql`
  query GetProjectOverview($projectId: ID!) {
    project(projectId: $projectId) {
      name
      description
      createdAt
      updatedAt
      status
      priority
      visibility
      progress
      startDate
      endDate
      owner {
        id
        username
        fullName
        avatarUrl
      }
    }
  }
`;

export const OverviewTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const pathname = usePathname();
  const { loading, error, data } = useQuery<ProjectOverviewResponse>(GET_PROJECT_OVERVIEW, {
    variables: { projectId },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data?.project) return <div>No project data available</div>;

  const project = data.project;

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Project Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1">{project.name}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body1">{project.status}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Priority
                </Typography>
                <Typography variant="body1">{project.priority}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body1">{project.progress}%</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Start Date
                </Typography>
                <Typography variant="body1">
                  {new Date(project.startDate).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  End Date
                </Typography>
                <Typography variant="body1">
                  {new Date(project.endDate).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">{project.description}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}; 