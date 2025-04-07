import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import { gql } from '@apollo/client';

// Định nghĩa các loại báo cáo
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

// Định nghĩa cấu trúc của một bug trong report
export interface ReportBug {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'major' | 'minor';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigneeId?: string;
  assignee?: {
    userId: string;
    username: string;
    avatarUrl?: string;
  };
  dateDiscovered: string;
  dateResolved?: string;
}

// Định nghĩa cấu trúc của một task trong báo cáo
export interface ReportTask {
  taskId: string;
  title: string;
  assignee?: {
    userId: string;
    username: string;
    avatarUrl?: string;
  };
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status: string;
  isDelayed: boolean;
  delayReason?: string;
}

// Định nghĩa cấu trúc của một báo cáo
export interface Report {
  id: string;
  reportType: ReportType;
  reportDate: string;
  planId?: string;
  periodStartDate: string;
  periodEndDate: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  onScheduleTasks: number;
  newStartedTasks: number;
  unassignedResources: string[];
  totalBugs: number;
  criticalBugs: number;
  majorBugs: number;
  minorBugs: number;
  resolvedBugs: number;
  summary?: string;
  tasks?: ReportTask[];
  bugs?: ReportBug[];
  createdAt: string;
  updatedAt?: string;
}

// Định nghĩa state của reports trong Redux
interface ReportsState {
  reports: Report[];
  currentReport: Report | null;
  dailyReports: Report[];
  loading: boolean;
  error: string | null;
}

// State ban đầu
const initialState: ReportsState = {
  reports: [],
  currentReport: null,
  dailyReports: [],
  loading: false,
  error: null
};

// GraphQL query lấy báo cáo theo projectId và loại báo cáo
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

// GraphQL query lấy chi tiết của một báo cáo
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

// GraphQL mutation tạo báo cáo mới
export const CREATE_REPORT = gql`
  mutation CreateReport($input: ReportInput!) {
    createReport(input: $input) {
      id
      reportType
      reportDate
      summary
      createdAt
    }
  }
`;

// Async thunk để fetch danh sách báo cáo theo dự án
export const fetchProjectReports = createAsyncThunk(
  'reports/fetchProjectReports',
  async ({ projectId, reportType }: { projectId: string, reportType?: ReportType }, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_PROJECT_REPORTS,
        variables: { projectId, reportType },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.reports;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải danh sách báo cáo');
    }
  }
);

// Async thunk để fetch chi tiết báo cáo
export const fetchReportDetail = createAsyncThunk(
  'reports/fetchReportDetail',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const response = await client.query({
        query: GET_REPORT_DETAIL,
        variables: { reportId },
        fetchPolicy: 'network-only'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tải chi tiết báo cáo');
    }
  }
);

// Async thunk để tạo báo cáo mới
export const createReport = createAsyncThunk(
  'reports/createReport',
  async (reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      const response = await client.mutate({
        mutation: CREATE_REPORT,
        variables: { input: reportData },
        fetchPolicy: 'no-cache'
      });
      
      if (response.errors) {
        return rejectWithValue(response.errors[0].message);
      }
      
      return response.data.createReport;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Lỗi khi tạo báo cáo mới');
    }
  }
);

// Tạo slice cho reports
const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setCurrentReport: (state, action: PayloadAction<Report | null>) => {
      state.currentReport = action.payload;
    },
    clearReports: (state) => {
      state.reports = [];
      state.currentReport = null;
      state.error = null;
    },
    generateDailyReport: (state, action: PayloadAction<Report>) => {
      const newReport = action.payload;
      state.currentReport = newReport;
    }
  },
  extraReducers: (builder) => {
    builder
      // Xử lý fetchProjectReports
      .addCase(fetchProjectReports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectReports.fulfilled, (state, action) => {
        state.loading = false;
        state.reports = action.payload;
        if (action.meta.arg.reportType === 'daily') {
          state.dailyReports = action.payload;
        }
      })
      .addCase(fetchProjectReports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Xử lý fetchReportDetail
      .addCase(fetchReportDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReportDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentReport = action.payload;
      })
      .addCase(fetchReportDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Xử lý createReport
      .addCase(createReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createReport.fulfilled, (state, action) => {
        state.loading = false;
        state.reports = [action.payload, ...state.reports];
        state.currentReport = action.payload;
      })
      .addCase(createReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setCurrentReport, clearReports, generateDailyReport } = reportsSlice.actions;
export default reportsSlice.reducer; 