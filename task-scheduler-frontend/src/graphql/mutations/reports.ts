import { gql } from '@apollo/client';

export const CREATE_REPORT = gql`
  mutation CreateReport($input: ReportInput!) {
    createReport(input: $input) {
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

export const UPDATE_REPORT = gql`
  mutation UpdateReport($input: UpdateReportInput!) {
    updateReport(input: $input) {
      id
      reportType
      reportDate
      summary
      updatedAt
    }
  }
`;

export const DELETE_REPORT = gql`
  mutation DeleteReport($reportId: ID!) {
    deleteReport(reportId: $reportId) {
      success
      message
    }
  }
`; 