import { useState, useEffect } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { PieChart, Pie, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Define types
type ReportTabType = 'overview' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'bugs' | 'plan-vs-actual';
type DailySubTab = 'yesterday' | 'today';

// Status colors for pie chart
const STATUS_COLORS: Record<string, string> = {
  'todo': '#6366f1',
  'in-progress': '#f59e0b',
  'pending': '#94a3b8',
  'completed': '#10b981',
  'blocked': '#ef4444',
  'cancelled': '#6b7280',
};

export function ProjectReportView({ projectId }: { projectId: string }) {
  // State for active tabs
  const [activeTab, setActiveTab] = useState<ReportTabType>('overview');
  const [activeSubTab, setActiveSubTab] = useState<DailySubTab>('yesterday');

  // Get data from Redux store
  const { tasks } = useAppSelector(state => state.tasks);
  const { plans, activePlan } = useAppSelector(state => state.plans);

  // Process tasks data for charts
  const [tasksByStatus, setTasksByStatus] = useState<any[]>([]);
  const [taskProgressData, setTaskProgressData] = useState<any[]>([]);
  const [tasksByPriority, setTasksByPriority] = useState<any[]>([]);
  const [delayedTasksByAssignee, setDelayedTasksByAssignee] = useState<any[]>([]);
  
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
      const status = task.status.toLowerCase();
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

    // Group tasks by priority for bar chart (bugs)
    const priorityCounts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    tasks.forEach(task => {
      if (task.type?.toLowerCase() === 'bug') {
        const priority = task.priority?.toLowerCase() || 'medium';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      }
    });
    
    const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
    }));
    setTasksByPriority(priorityData);

    // Get delayed tasks by assignee
    const today = new Date();
    const delayedByAssignee: Record<string, number> = {};
    
    tasks.forEach(task => {
      if (task.status.toLowerCase() !== 'completed' && task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate < today) {
          const assigneeName = task.assignee?.username || 'Unassigned';
          delayedByAssignee[assigneeName] = (delayedByAssignee[assigneeName] || 0) + 1;
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
  };

  // Process tasks for daily report
  const processTasksForDailyReport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Process tasks for yesterday report
    const completedYesterday = tasks.filter(task => {
      if (!task.actual_end_date) return false;
      const endDate = new Date(task.actual_end_date);
      return endDate >= yesterday && endDate < today;
    });
    setYesterdayCompletedTasks(completedYesterday);

    const delayedYesterday = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate < today && task.status.toLowerCase() !== 'completed';
    });
    setYesterdayDelayedTasks(delayedYesterday);

    const startedYesterday = tasks.filter(task => {
      if (!task.actual_start_date) return false;
      const startDate = new Date(task.actual_start_date);
      return startDate >= yesterday && startDate < today;
    });
    setYesterdayStartedTasks(startedYesterday);

    // Process member work summary
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
        
        if (task.status.toLowerCase() === 'completed') {
          memberSummary[memberName].completed += 1;
        } else if (task.status.toLowerCase() === 'in-progress') {
          memberSummary[memberName].inProgress += 1;
        }
        
        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          if (dueDate < today && task.status.toLowerCase() !== 'completed') {
            memberSummary[memberName].delayed += 1;
          }
        }
      }
    });
    setMemberWorkSummary(memberSummary);

    // Process tasks for today report
    const startingToday = tasks.filter(task => {
      if (!task.start_date) return false;
      const startDate = new Date(task.start_date);
      return startDate >= today && startDate < tomorrow;
    });
    setTodayStartingTasks(startingToday);

    const completingToday = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate >= today && dueDate < tomorrow;
    });
    setTodayCompletingTasks(completingToday);

    // Identify assigned and unassigned members for today
    const membersWithTasksToday = new Set<string>();
    const allMemberIds = new Set<string>();
    
    tasks.forEach(task => {
      if (task.assignee) {
        allMemberIds.add(task.assignee.userId);
        
        // Check if member has tasks for today
        if (task.start_date || task.due_date) {
          const startDate = task.start_date ? new Date(task.start_date) : null;
          const dueDate = task.due_date ? new Date(task.due_date) : null;
          
          if ((startDate && startDate >= today && startDate < tomorrow) ||
              (dueDate && dueDate >= today && dueDate < tomorrow)) {
            membersWithTasksToday.add(task.assignee.userId);
          }
        }
      }
    });
    
    // Get members who have tasks today
    const assigned = Array.from(membersWithTasksToday).map(memberId => {
      return tasks.find(task => task.assignee?.userId === memberId)?.assignee;
    }).filter(Boolean);
    setAssignedMembers(assigned);
    
    // Get members who don't have tasks today
    const unassigned = Array.from(allMemberIds)
      .filter(memberId => !membersWithTasksToday.has(memberId))
      .map(memberId => {
        return tasks.find(task => task.assignee?.userId === memberId)?.assignee;
      }).filter(Boolean);
    setUnassignedMembers(unassigned);
  };

  // Get the active plan name
  const activePlanName = activePlan ? activePlan.name : 'Không có kế hoạch hoạt động';

  // Report tabs definition
  const reportTabs = [
    { id: 'overview', label: 'Dashboard tổng quan' },
    { id: 'daily', label: 'Báo cáo ngày' },
    { id: 'weekly', label: 'Báo cáo tuần' },
    { id: 'monthly', label: 'Báo cáo tháng' },
    { id: 'quarterly', label: 'Báo cáo quý' },
    { id: 'bugs', label: 'Quản lý Bug' },
    { id: 'plan-vs-actual', label: 'Plan vs Actual' },
  ];

  // Daily report sub-tabs
  const dailySubTabs = [
    { id: 'yesterday', label: 'Hôm qua' },
    { id: 'today', label: 'Hôm nay' },
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

      {/* Active plan info */}
      <div className="card p-4 mb-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Kế hoạch đang kích hoạt: <span className="text-blue-600">{activePlanName}</span></h3>
        </div>
      </div>

      {/* Report content */}
      <div className="card p-4">
        {/* Overview Dashboard */}
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-bold mb-6">Dashboard tổng quan</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Task Status Pie Chart */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">Tổng số task theo trạng thái</h3>
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
                <h3 className="text-lg font-medium mb-2">Tiến độ dự án so với kế hoạch</h3>
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
                      <Line type="monotone" dataKey="planned" stroke="#8884d8" name="Kế hoạch" />
                      <Line type="monotone" dataKey="actual" stroke="#82ca9d" name="Thực tế" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bug Severity Bar Chart */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">Số lượng bug theo mức độ nghiêm trọng</h3>
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
                      <Bar dataKey="count" name="Số lượng bug" fill="#ff7300" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Delayed Tasks by Assignee */}
              <div className="card p-4 shadow-sm">
                <h3 className="text-lg font-medium mb-2">Các assignee có task bị trễ nhiều nhất</h3>
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
                      <Bar dataKey="count" name="Số task trễ" fill="#8884d8" />
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
            <h2 className="text-xl font-bold mb-4">Báo cáo ngày</h2>
            
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
                  <h3 className="text-lg font-medium mb-2">Các task đã hoàn thành</h3>
                  {yesterdayCompletedTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hoàn thành lúc</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {yesterdayCompletedTasks.map((task) => (
                            <tr key={task.taskId}>
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
                    <p className="text-slate-500">Không có task nào được hoàn thành.</p>
                  )}
                </div>
                
                {/* Delayed Tasks */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">Các task bị trễ so với kế hoạch</h3>
                  {yesterdayDelayedTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Deadline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {yesterdayDelayedTasks.map((task) => (
                            <tr key={task.taskId}>
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
                    <p className="text-slate-500">Không có task nào bị trễ.</p>
                  )}
                </div>
                
                {/* Member work summary */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">Tổng hợp công việc theo thành viên</h3>
                  {Object.keys(memberWorkSummary).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thành viên</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Đã hoàn thành</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Đang làm</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bị trễ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng số</th>
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
                    <p className="text-slate-500">Không có dữ liệu công việc thành viên.</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Today's Report */}
            {activeSubTab === 'today' && (
              <div className="space-y-6">
                {/* Tasks expected to start today */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">Các task dự kiến bắt đầu hôm nay</h3>
                  {todayStartingTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {todayStartingTasks.map((task) => (
                            <tr key={task.taskId}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.assignee?.username || 'Unassigned'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">Không có task nào dự kiến bắt đầu hôm nay.</p>
                  )}
                </div>
                
                {/* Tasks expected to complete today */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">Các task dự kiến hoàn thành hôm nay</h3>
                  {todayCompletingTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tiến độ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {todayCompletingTasks.map((task) => (
                            <tr key={task.taskId}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{task.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.assignee?.username || 'Unassigned'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.progress || 0}%</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{task.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">Không có task nào dự kiến hoàn thành hôm nay.</p>
                  )}
                </div>

                {/* Unassigned members */}
                <div className="card p-4 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">Các thành viên không có task được phân công hôm nay</h3>
                  {unassignedMembers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thành viên</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
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
                    <p className="text-slate-500">Tất cả thành viên đều có task được phân công hôm nay.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly, Monthly, Quarterly Reports Placeholders */}
        {['weekly', 'monthly', 'quarterly', 'bugs', 'plan-vs-actual'].includes(activeTab) && (
          <div className="py-8 text-center text-slate-600">
            <h3 className="text-xl font-medium mb-2">Tính năng đang phát triển</h3>
            <p>Báo cáo {activeTab === 'weekly' ? 'tuần' : 
                        activeTab === 'monthly' ? 'tháng' : 
                        activeTab === 'quarterly' ? 'quý' : 
                        activeTab === 'bugs' ? 'quản lý bug' : 
                        'so sánh kế hoạch và thực tế'} sẽ sớm được cập nhật.</p>
          </div>
        )}
      </div>
    </div>
  );
} 