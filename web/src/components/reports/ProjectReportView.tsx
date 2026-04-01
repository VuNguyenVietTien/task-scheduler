import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/redux/hooks';
import { PieChart, Pie, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { PeriodReportView } from './period-report-view';
import { useDailyReportData } from './daily-report-view';

// Define types
type ReportTabType = 'overview' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'bugs' | 'plan-vs-actual';
type DailySubTab = 'yesterday' | 'today';

// Status colors for pie chart
const STATUS_COLORS: Record<string, string> = {
  'TODO': '#6366f1',
  'in-progress': '#f59e0b',
  'PENDING': '#94a3b8',
  'completed': '#10b981',
  'BLOCKED': '#ef4444',
  'cancelled': '#6b7280',
};

// Định nghĩa hàm xác định trạng thái tiến độ task
const determineTaskScheduleStatus = (task: any, planData: any[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Tìm planTask tương ứng
  const planTask = planData.find((pt: any) => (pt.task_id || pt.taskId) === task.task_id);
  
  if (task.status.toUpperCase() === 'DONE') {
    // Kiểm tra hoàn thành đúng hạn
    if ((planTask && task.actual_end_date && new Date(task.actual_end_date) <= new Date(planTask.end_date)) ||
        (!planTask && task.actual_end_date && task.due_date && new Date(task.actual_end_date) <= new Date(task.due_date))) {
      return { status: 'on-schedule', labelKey: 'reports.onSchedule', color: 'text-green-600' };
    } else {
      return { status: 'late', labelKey: 'reports.lateSchedule', color: 'text-red-600' };
    }
  } else if (task.status.toUpperCase() === 'TODO') {
    // Kiểm tra chưa đến thời gian bắt đầu
    const startDate = planTask?.start_date ? new Date(planTask.start_date) : (task.start_date ? new Date(task.start_date) : null);
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
      if (today.getTime() < startDate.getTime()) {
        return { status: 'on-schedule', labelKey: 'reports.notStarted', color: 'text-blue-600' };
      } else if (today.getTime() === startDate.getTime()) {
        return { status: 'on-schedule', labelKey: 'reports.startingToday', color: 'text-green-600' };
      } else {
        return { status: 'late', labelKey: 'reports.lateStart', color: 'text-red-600' };
      }
    }
  } else if (['DOING', 'REVIEW', 'PENDING', 'BLOCKED'].includes(task.status.toUpperCase())) {
    // Kiểm tra đang làm và chưa đến deadline
    const dueDate = planTask?.end_date ? new Date(planTask.end_date) : (task.due_date ? new Date(task.due_date) : null);
    if (dueDate) {
      dueDate.setHours(0, 0, 0, 0);
      if (today.getTime() <= dueDate.getTime()) {
        return { status: 'on-schedule', labelKey: 'reports.inProgressOnSchedule', color: 'text-green-600' };
      } else {
        return { status: 'late', labelKey: 'reports.inProgressLate', color: 'text-red-600' };
      }
    }
  } else if (['DONE', 'CLOSE', 'ARCHIVED'].includes(task.status.toUpperCase())) {
    return { status: 'on-schedule', labelKey: 'reports.completed', color: 'text-green-600' };
  } else if (task.status.toUpperCase() === 'REJECTED') {
    return { status: 'on-schedule', labelKey: 'reports.rejected', color: 'text-gray-600' };
  }

  return { status: 'unknown', labelKey: 'reports.unknown', color: 'text-gray-500' };
};

export function ProjectReportView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  // State for active tabs
  const [activeTab, setActiveTab] = useState<ReportTabType>('overview');
  const [activeSubTab, setActiveSubTab] = useState<DailySubTab>('yesterday');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Get data from Redux store
  const { tasks } = useAppSelector(state => state.tasks);
  const { plans, activePlan } = useAppSelector(state => state.plans);

  // Use the fixed daily report data hook (plan-aware)
  const dailyReportData = useDailyReportData(projectId);

  // Default to active plan
  useEffect(() => {
    if (activePlan && !selectedPlanId) setSelectedPlanId(activePlan.id);
  }, [activePlan]);
  
  // Khai báo state cho planTasks để dùng trong cả component
  const [planTasks, setPlanTasks] = useState<any[]>([]);

  // Process tasks data for charts
  const [tasksByStatus, setTasksByStatus] = useState<any[]>([]);
  const [taskProgressData, setTaskProgressData] = useState<any[]>([]);
  const [tasksByPriority, setTasksByPriority] = useState<any[]>([]);
  const [delayedTasksByAssignee, setDelayedTasksByAssignee] = useState<any[]>([]);
  const [overdueTaskCount, setOverdueTaskCount] = useState(0);
  const [onScheduleTaskCount, setOnScheduleTaskCount] = useState(0);
  
  // Process yesterday's tasks for daily report
  const [yesterdayCompletedTasks, setYesterdayCompletedTasks] = useState<any[]>([]);
  const [yesterdayDelayedTasks, setYesterdayDelayedTasks] = useState<any[]>([]);
  const [yesterdayStartedTasks, setYesterdayStartedTasks] = useState<any[]>([]);
  const [memberWorkSummary, setMemberWorkSummary] = useState<Record<string, any>>({});
  
  // Process today's tasks for daily report
  const [todayStartingTasks, setTodayStartingTasks] = useState<any[]>([]);
  const [todayCompletingTasks, setTodayCompletingTasks] = useState<any[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<any[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<any[]>([]);

  // Process data when tasks or plans change
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      // Cập nhật planTasks từ activePlan
      const newPlanTasks = activePlan?.planData?.tasks || [];
      setPlanTasks(newPlanTasks);
      
      // Process data for dashboard overview
      processTasksForOverview();
      
      // Process data for daily report
      processTasksForDailyReport();
    }
  }, [tasks, plans, activePlan]);

  // Process tasks for overview dashboard
  const processTasksForOverview = () => {
    // Group tasks by status for pie chart
    const statusCounts: Record<string, number> = {};
    tasks.forEach(task => {
      const status = task.status.toUpperCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
    setTasksByStatus(statusData);

    // Generate task progress data (simplified for example)
    const lastTwoWeeks = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      return {
        date: format(date, 'dd/MM'),
        planned: Math.floor(Math.random() * 10) + 5, // Mock data
        actual: Math.floor(Math.random() * 10) + 2, // Mock data
      };
    });
    setTaskProgressData(lastTwoWeeks);

    // Group tasks by priority for bar chart (bugs) - chỉ count bug chưa done/close
    const priorityCounts: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    tasks.forEach(task => {
      const status = task.status.toUpperCase();
      if (task.type?.toLowerCase() === 'bug' && !['DONE', 'CLOSE', 'ARCHIVED'].includes(status)) {
        const priority = task.priority?.toUpperCase() || 'MEDIUM';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      }
    });
    
    const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
    }));
    setTasksByPriority(priorityData);

    // Get delayed tasks by assignee - loại trừ task done/close/archived
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delayedByAssignee: Record<string, number> = {};
    const completedStatuses = ['DONE', 'CLOSE', 'ARCHIVED', 'REJECTED'];

    // Đếm task trễ và đúng tiến độ cho overview cards
    let overdueCount = 0;
    let onScheduleCount = 0;
    const currentPlanTasksForOverview = activePlan?.planData?.tasks || [];

    tasks.forEach(task => {
      const status = task.status.toUpperCase();

      // Tính overdue/on-schedule cho tất cả task chưa hoàn thành
      if (!completedStatuses.includes(status)) {
        const planTask = currentPlanTasksForOverview.find((pt: any) => (pt.task_id || pt.taskId) === task.task_id);
        const dueDate = planTask?.end_date
          ? new Date(planTask.end_date)
          : (task.due_date ? new Date(task.due_date) : null);

        if (dueDate) {
          const dueDateNorm = new Date(dueDate);
          dueDateNorm.setHours(0, 0, 0, 0);
          if (dueDateNorm < today) {
            overdueCount++;
            // Count by assignee
            const assigneeName = task.assignee?.username || 'Unassigned';
            delayedByAssignee[assigneeName] = (delayedByAssignee[assigneeName] || 0) + 1;
          } else {
            onScheduleCount++;
          }
        } else {
          // Không có deadline → coi là on-schedule
          onScheduleCount++;
        }
      }
    });
    
    const assigneeData = Object.entries(delayedByAssignee)
      .map(([assignee, count]) => ({
        assignee,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 assignees with most delayed tasks

    setDelayedTasksByAssignee(assigneeData);
    setOverdueTaskCount(overdueCount);
    setOnScheduleTaskCount(onScheduleCount);
  };

  // Process tasks for daily report
  const processTasksForDailyReport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Dữ liệu tasks và plan - không cần khai báo lại ở đây vì đã có state
    const currentPlanTasks = activePlan?.planData?.tasks || [];
    
    console.log('Processing daily report with plan tasks:', currentPlanTasks);
    console.log('And tasks:', tasks);

    // ---- XỬ LÝ BÁO CÁO HÔM QUA ----
    
    // 1. Các task đã hoàn thành hôm qua
    // Lọc các task có status="done" và actual_end_date là ngày hôm qua
    const completedYesterday = tasks.filter(task => {
      if (task.status.toUpperCase() !== 'DONE') return false;
      if (!task.actual_end_date) return false;
      
      const endDate = new Date(task.actual_end_date);
      endDate.setHours(0, 0, 0, 0);
      return endDate.getTime() === yesterday.getTime();
    });
    setYesterdayCompletedTasks(completedYesterday);

    // 2. Các task bị trễ so với kế hoạch
    // Lọc các task có due_date <= hôm qua nhưng status chưa phải done
    const delayedYesterday = tasks.filter(task => {
      // Kiểm tra trong planData trước (ưu tiên cao hơn)
      const planTask = currentPlanTasks.find(pt => (pt.task_id || pt.taskId) === task.task_id);
      
      // Trường hợp 1: Theo plan - task phải bắt đầu hôm qua hoặc trước đó mà vẫn là todo
      if (planTask && planTask.start_date) {
        const planStartDate = new Date(planTask.start_date);
        planStartDate.setHours(0, 0, 0, 0);
        if (planStartDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() === 'TODO') {
          return true; // Trễ, lẽ ra phải ở trạng thái doing trở lên
        }
      }

      // Trường hợp 2: Theo plan - task phải hoàn thành hôm qua hoặc trước đó mà chưa done
      if (planTask && planTask.end_date) {
        const planEndDate = new Date(planTask.end_date);
        planEndDate.setHours(0, 0, 0, 0);
        if (planEndDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() !== 'DONE') {
          return true; // Trễ, lẽ ra phải ở trạng thái done
        }
      }

      // Trường hợp 3: Nếu không có plan, kiểm tra theo start_date - task phải bắt đầu hôm qua hoặc trước đó mà vẫn là todo
      if (!planTask && task.start_date) {
        const startDate = new Date(task.start_date);
        startDate.setHours(0, 0, 0, 0);
        if (startDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() === 'TODO') {
          return true; // Trễ, lẽ ra phải ở trạng thái doing trở lên
        }
      }

      // Trường hợp 4: Nếu không có plan, kiểm tra theo due_date - task phải hoàn thành hôm qua hoặc trước đó mà chưa done
      if (!planTask && task.due_date) {
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() !== 'DONE') {
          return true; // Trễ, lẽ ra phải ở trạng thái done
        }
      }
      
      return false;
    });
    setYesterdayDelayedTasks(delayedYesterday);

    // 3. Các task đã bắt đầu hôm qua
    // Lọc các task có actual_start_date là ngày hôm qua
    const startedYesterday = tasks.filter(task => {
      if (!task.actual_start_date) return false;
      
      const startDate = new Date(task.actual_start_date);
      startDate.setHours(0, 0, 0, 0);
      return startDate.getTime() === yesterday.getTime();
    });
    setYesterdayStartedTasks(startedYesterday);

    // ---- XỬ LÝ TỔNG HỢP CÔNG VIỆC THEO THÀNH VIÊN ----
    
    // Tạo bảng tổng hợp công việc theo thành viên
    const memberSummary: Record<string, any> = {};
    
    tasks.forEach(task => {
      if (task.assignee) {
        const memberName = task.assignee.username;
        
        if (!memberSummary[memberName]) {
          memberSummary[memberName] = {
            completed: 0,
            inProgress: 0,
            delayed: 0,
            total: 0
          };
        }
        
        memberSummary[memberName].total += 1;
        
        if (task.status.toUpperCase() === 'DONE') {
          memberSummary[memberName].completed += 1;
        } else if (['DOING', 'REVIEW'].includes(task.status.toUpperCase())) {
          memberSummary[memberName].inProgress += 1;
        }
        
        // Kiểm tra task bị trễ - cập nhật theo logic mới
        const planTask = currentPlanTasks.find(pt => (pt.task_id || pt.taskId) === task.task_id);
        
        // Kiểm tra trễ theo plan
        if (planTask) {
          // Trễ bắt đầu theo plan
          if (planTask.start_date) {
            const planStartDate = new Date(planTask.start_date);
            planStartDate.setHours(0, 0, 0, 0);
            if (planStartDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() === 'TODO') {
              memberSummary[memberName].delayed += 1;
            }
          }

          // Trễ kết thúc theo plan
          if (planTask.end_date) {
            const planEndDate = new Date(planTask.end_date);
            planEndDate.setHours(0, 0, 0, 0);
            if (planEndDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() !== 'DONE') {
              memberSummary[memberName].delayed += 1;
            }
          }
        } 
        // Kiểm tra trễ theo task nếu không có plan
        else {
          // Trễ bắt đầu
          if (task.start_date) {
            const startDate = new Date(task.start_date);
            startDate.setHours(0, 0, 0, 0);
            if (startDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() === 'TODO') {
              memberSummary[memberName].delayed += 1;
            }
          }
          
          // Trễ kết thúc
          if (task.due_date) {
            const dueDate = new Date(task.due_date);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate.getTime() <= yesterday.getTime() && task.status.toUpperCase() !== 'DONE') {
              memberSummary[memberName].delayed += 1;
            }
          }
        }
      }
    });
    setMemberWorkSummary(memberSummary);

    // ---- XỬ LÝ BÁO CÁO HÔM NAY ----
    
    // 1. Các task dự kiến bắt đầu hôm nay (từ planData hoặc từ start_date)
    const startingToday = [...tasks].filter(task => {
      // Kiểm tra trong planData trước (ưu tiên cao hơn)
      const planTask = currentPlanTasks.find(pt => (pt.task_id || pt.taskId) === task.task_id);
      if (planTask && planTask.start_date) {
        const planStartDate = new Date(planTask.start_date);
        planStartDate.setHours(0, 0, 0, 0);
        return planStartDate.getTime() === today.getTime() &&
               task.status.toUpperCase() === 'TODO';
      }

      // Kiểm tra start_date của task nếu không có trong plan
      if (task.start_date) {
        const startDate = new Date(task.start_date);
        startDate.setHours(0, 0, 0, 0);
        return startDate.getTime() === today.getTime() &&
               task.status.toUpperCase() === 'TODO';
      }
      
      return false;
    });
    setTodayStartingTasks(startingToday);

    // 2. Các task dự kiến hoàn thành hôm nay (từ planData hoặc từ due_date)
    const completingToday = [...tasks].filter(task => {
      // Kiểm tra trong planData trước (ưu tiên cao hơn)
      const planTask = currentPlanTasks.find(pt => (pt.task_id || pt.taskId) === task.task_id);
      if (planTask && planTask.end_date) {
        const planEndDate = new Date(planTask.end_date);
        planEndDate.setHours(0, 0, 0, 0);
        return planEndDate.getTime() === today.getTime() &&
               task.status.toUpperCase() !== 'DONE';
      }

      // Kiểm tra due_date của task nếu không có trong plan
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime() &&
               task.status.toUpperCase() !== 'DONE';
      }
      
      return false;
    });
    setTodayCompletingTasks(completingToday);

    // 3. Xác định các thành viên có task được phân công hôm nay
    const membersWithTasksToday = new Set<string>();
    const allMemberIds = new Set<string>();
    
    tasks.forEach(task => {
      if (task.assignee) {
        allMemberIds.add(task.assignee.userId);
        
        // Kiểm tra thành viên có task trong ngày hôm nay
        // 1. Kiểm tra trong planData
        const planTask = currentPlanTasks.find(pt => (pt.task_id || pt.taskId) === task.task_id);
        if (planTask) {
          const hasTaskToday = 
            (planTask.start_date && new Date(planTask.start_date).toDateString() === today.toDateString()) ||
            (planTask.end_date && new Date(planTask.end_date).toDateString() === today.toDateString()) ||
            (planTask.status === 'DOING' || planTask.status === 'REVIEW');

          if (hasTaskToday) {
            membersWithTasksToday.add(task.assignee.userId);
          }
        }
        // 2. Kiểm tra trong dữ liệu task nếu không có trong plan
        else if (
          (task.start_date && new Date(task.start_date).toDateString() === today.toDateString()) ||
          (task.due_date && new Date(task.due_date).toDateString() === today.toDateString()) ||
          (task.status.toUpperCase() === 'DOING' || task.status.toUpperCase() === 'REVIEW')
        ) {
          membersWithTasksToday.add(task.assignee.userId);
        }
      }
    });
    
    // Lấy thông tin thành viên
    const assigned = Array.from(membersWithTasksToday).map(memberId => {
      return tasks.find(task => task.assignee?.userId === memberId)?.assignee;
    }).filter(Boolean);
    setAssignedMembers(assigned);
    
    // Lấy thành viên không có task hôm nay
    const unassigned = Array.from(allMemberIds)
      .filter(memberId => !membersWithTasksToday.has(memberId))
      .map(memberId => {
        return tasks.find(task => task.assignee?.userId === memberId)?.assignee;
      }).filter(Boolean);
    setUnassignedMembers(unassigned);
    
    // Update planTasks trong state từ dữ liệu mới
    setPlanTasks(currentPlanTasks);
  };

  // Get the active plan name
  const activePlanName = activePlan ? activePlan.name : 'Không có kế hoạch hoạt động';

  // Report tabs definition
  const reportTabs = [
    { id: 'overview', label: t('reports.overview') },
    { id: 'daily', label: t('reports.daily') },
    { id: 'weekly', label: t('reports.weekly') },
    { id: 'monthly', label: t('reports.monthly') },
    { id: 'quarterly', label: t('reports.quarterly') },
    { id: 'bugs', label: t('reports.bugManagement') },
    { id: 'plan-vs-actual', label: 'Plan vs Actual' },
  ];

  // Daily report sub-tabs
  const dailySubTabs = [
    { id: 'yesterday', label: t('reports.yesterday') },
    { id: 'today', label: t('reports.today') },
  ];

  return (
    <div className="h-full overflow-auto">
      {/* Report tabs */}
      <div className="card mb-4">
        <div className="flex space-x-6 overflow-x-auto pb-2">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTabType)}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plan selector + active plan info */}
      <div className="card p-4 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium">{t('reports.planLabel')}</h3>
            <select
              className="select select-bordered select-sm"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              aria-label={t('reports.selectPlan')}
            >
              <option value="">{t('reports.noSelection')}</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name || plan.id.slice(0, 8)}
                  {activePlan?.id === plan.id ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report content */}
      <div className="card p-4">
        {/* Overview Dashboard */}
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-bold mb-6">{t('reports.overviewDashboard')}</h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-4 shadow-sm text-center">
                <p className="text-sm text-slate-500">{t('reports.totalTasks')}</p>
                <p className="text-2xl font-bold text-slate-800">{tasks.length}</p>
              </div>
              <div className="card p-4 shadow-sm text-center">
                <p className="text-sm text-slate-500">{t('reports.completedTasks')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {tasks.filter(task => ['DONE', 'CLOSE'].includes(task.status.toUpperCase())).length}
                </p>
              </div>
              <div className="card p-4 shadow-sm text-center">
                <p className="text-sm text-slate-500">{t('reports.onScheduleCount')}</p>
                <p className="text-2xl font-bold text-blue-600">{onScheduleTaskCount}</p>
              </div>
              <div className="card p-4 shadow-sm text-center">
                <p className="text-sm text-slate-500">{t('reports.overdueCount')}</p>
                <p className="text-2xl font-bold text-red-600">{overdueTaskCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Task Status Pie Chart */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">{t('reports.tasksByStatus')}</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tasksByStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={(entry) => `${entry.status}: ${entry.count}`}
                      >
                        {tasksByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#8884d8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Project Progress Line Chart */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">{t('reports.projectProgressVsPlan')}</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={taskProgressData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="planned" stroke="#8884d8" name={t('reports.plan')} />
                      <Line type="monotone" dataKey="actual" stroke="#82ca9d" name={t('reports.actual')} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bug Severity Bar Chart */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">{t('reports.bugsBySeverity')}</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tasksByPriority}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="priority" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name={t('reports.bugCount')} fill="#ff7300" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Delayed Tasks by Assignee */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">{t('reports.topDelayedAssignees')}</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={delayedTasksByAssignee}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="assignee" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name={t('reports.lateTasks')} fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Report */}
        {activeTab === 'daily' && (
          <div>
            <h2 className="text-xl font-bold mb-4">{t('reports.dailyReport')}</h2>
            
            {/* Daily Report Sub-tabs */}
            <div className="flex space-x-4 mb-6 border-b">
              {dailySubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as DailySubTab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                    activeSubTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Yesterday's Report */}
            {activeSubTab === 'yesterday' && (
              <div className="space-y-6">
                {/* Completed Tasks */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">{t('reports.completedTasksTitle')}</h3>
                  {yesterdayCompletedTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.completedAt')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {yesterdayCompletedTasks.map((task) => (
                            <tr key={task.task_id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.assignee?.username || 'Unassigned'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {task.actual_end_date ? format(new Date(task.actual_end_date), 'dd/MM/yyyy HH:mm') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">{t('reports.noCompletedTasks')}</p>
                  )}
                </div>
                
                {/* Delayed Tasks */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">{t('reports.delayedTasks')}</h3>
                  {yesterdayDelayedTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Deadline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {yesterdayDelayedTasks.map((task) => (
                            <tr key={task.task_id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.assignee?.username || 'Unassigned'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy') : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">{t('reports.noDelayedTasks')}</p>
                  )}
                </div>
                
                {/* Member work summary */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">{t('reports.memberWorkSummary')}</h3>
                  {Object.keys(memberWorkSummary).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.colMember')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.colCompleted')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.colInProgress')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.colDelayed')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.colTotal')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {Object.entries(memberWorkSummary).map(([member, data]) => (
                            <tr key={member}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{member}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{data.completed}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{data.inProgress}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{data.delayed}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{data.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">{t('reports.noMemberWorkData')}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Today's Report */}
            {activeSubTab === 'today' && (
              <div className="space-y-6">
                {/* Overdue from plan - tasks that should have started but haven't */}
                {dailyReportData.overduePlanTasks.length > 0 && (
                  <div className="card p-4 shadow-sm border-l-4 border-orange-500">
                    <h3 className="text-lg font-medium mb-1 text-orange-600">
                      {t('reports.overdueNotStarted', { count: dailyReportData.overduePlanTasks.length })}
                    </h3>
                    <p className="text-sm text-slate-500 mb-3">
                      {t('reports.overdueNotStartedDesc')}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('reports.planStartDate')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('common.status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('reports.daysBehind')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {dailyReportData.overduePlanTasks.map(task => (
                            <tr key={task.taskId}>
                              <td className="px-6 py-4 text-sm font-medium text-slate-900">{task.title}</td>
                              <td className="px-6 py-4 text-sm text-slate-500">{task.assignee}</td>
                              <td className="px-6 py-4 text-sm text-slate-500">
                                {new Date(task.planStartDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs text-white ${
                                  task.status === 'BLOCKED' ? 'bg-red-500' :
                                  task.status === 'PENDING' ? 'bg-yellow-500' : 'bg-slate-400'
                                }`}>{task.status}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-red-600 font-medium">{task.daysBehind}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Metrics: scheduled to start today */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card p-4 shadow-sm text-center">
                    <p className="text-sm text-slate-500">{t('reports.scheduledToStart')}</p>
                    <p className="text-2xl font-bold text-purple-600">{dailyReportData.scheduledToStartToday.length}</p>
                  </div>
                  <div className="card p-4 shadow-sm text-center">
                    <p className="text-sm text-slate-500">{t('reports.actuallyStarted')}</p>
                    <p className="text-2xl font-bold text-blue-600">{dailyReportData.actuallyStartedToday.length}</p>
                  </div>
                  <div className="card p-4 shadow-sm text-center">
                    <p className="text-sm text-slate-500">{t('reports.openBugs')}</p>
                    <p className="text-2xl font-bold text-orange-600">{dailyReportData.bugTasks.length}</p>
                  </div>
                  <div className="card p-4 shadow-sm text-center">
                    <p className="text-sm text-slate-500">{t('reports.availableMembers')}</p>
                    <p className="text-2xl font-bold text-gray-600">{dailyReportData.unassignedUsers.length}</p>
                  </div>
                </div>

                {/* Tasks expected to start today */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">{t('reports.tasksStartingToday')}</h3>
                  {todayStartingTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.dataSource')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.plannedDate')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.progress')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {todayStartingTasks.map((task) => {
                            const planTask = planTasks.find((pt: any) => (pt.task_id || pt.taskId) === task.task_id);
                            const scheduleStatus = determineTaskScheduleStatus(task, planTasks || []);
                            return (
                              <tr key={task.task_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.assignee?.username || 'Unassigned'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{planTask ? t('reports.planSource') : 'Task'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                  {planTask?.start_date ? format(new Date(planTask.start_date), 'dd/MM/yyyy') :
                                   task.start_date ? format(new Date(task.start_date), 'dd/MM/yyyy') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.status}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${scheduleStatus.color}`}>
                                  {t(scheduleStatus.labelKey)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">{t('reports.noTasksStartingToday')}</p>
                  )}
                </div>
                
                {/* Tasks expected to complete today */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">{t('reports.tasksCompletingToday')}</h3>
                  {todayCompletingTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.dataSource')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Deadline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.progress')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.evaluation')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {todayCompletingTasks.map((task) => {
                            const planTask = planTasks.find((pt: any) => (pt.task_id || pt.taskId) === task.task_id);
                            const scheduleStatus = determineTaskScheduleStatus(task, planTasks || []);
                            return (
                              <tr key={task.task_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.assignee?.username || 'Unassigned'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{planTask ? t('reports.planSource') : 'Task'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                  {planTask?.end_date ? format(new Date(planTask.end_date), 'dd/MM/yyyy') :
                                   task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.progress || 0}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.status}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${scheduleStatus.color}`}>
                                  {t(scheduleStatus.labelKey)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">{t('reports.noTasksCompletingToday')}</p>
                  )}
                </div>

                {/* Unassigned members */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">{t('reports.membersWithNoTasks')}</h3>
                  {unassignedMembers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('reports.colMember')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.email')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {unassignedMembers.map((member) => (
                            <tr key={member.userId}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{member.username}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{member.email || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">{t('reports.allMembersAssigned')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly/Monthly/Quarterly Reports */}
        {['weekly', 'monthly', 'quarterly'].includes(activeTab) && (
          <PeriodReportView
            projectId={projectId}
            reportType={activeTab as any}
            planId={selectedPlanId || undefined}
          />
        )}

        {/* Bugs & Plan vs Actual - still in development */}
        {['bugs', 'plan-vs-actual'].includes(activeTab) && (
          <div className="py-8 text-center text-slate-600">
            <p>{t('reports.comingSoon')}</p>
          </div>
        )}
      </div>
    </div>
  );
} 