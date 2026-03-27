import { gql } from '@apollo/client';

export const GET_PROJECT_REPORTS = gql`
  query GetProjectReports($projectId: ID!, $reportType: String) {
    reports(projectId: $projectId, reportType: $reportType) {
      id
      reportType
      reportDate
      planId
      periodStartDate
      periodEndDate
      totalTasks
      completedTasks
      delayedTasks
      onScheduleTasks
      newStartedTasks
      unassignedResources
      totalBugs
      criticalBugs
      majorBugs
      minorBugs
      resolvedBugs
      summary
      createdAt
      updatedAt
    }
  }
`;

export const GET_REPORT_DETAIL = gql`
  query GetReportDetail($reportId: ID!) {
    report(reportId: $reportId) {
      id
      reportType
      reportDate
      planId
      periodStartDate
      periodEndDate
      totalTasks
      completedTasks
      delayedTasks
      onScheduleTasks
      newStartedTasks
      unassignedResources
      totalBugs
      criticalBugs
      majorBugs
      minorBugs
      resolvedBugs
      summary
      tasks {
        taskId
        title
        assignee {
          userId
          username
          avatarUrl
        }
        plannedStartDate
        plannedEndDate
        actualStartDate
        actualEndDate
        status
        isDelayed
        delayReason
      }
      bugs {
        id
        title
        severity
        status
        assignee {
          userId
          username
          avatarUrl
        }
        dateDiscovered
        dateResolved
      }
      createdAt
      updatedAt
    }
  }
`; 