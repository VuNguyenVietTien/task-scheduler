'use client';

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  fetchProjectReports, 
  createReport, 
  generateDailyReport,
  Report,
  ReportTask,
  ReportType
} from '@/redux/features/reportsSlice';
import { Task, TaskStatus } from '@/types/task';

interface ReportViewProps {
  projectId: string;
}

export function ReportView({ projectId }: ReportViewProps) {
  const dispatch = useAppDispatch();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  const { tasks } = useAppSelector(state => state.tasks);
  const { members } = useAppSelector(state => state.members);
  const { reports, currentReport, loading, error } = useAppSelector(state => state.reports);
  
  // Hàm tạo report từ dữ liệu tasks hiện tại
  const generateDailyReportFromTasks = () => {
    // Lấy ngày hiện tại
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    // Lọc các tasks theo trạng thái
    const completedTasks = tasks.filter(task => 
      task.status === 'done' || task.status === 'close'
    );
    
    const delayedTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate < today && 
        task.status !== 'done' && 
        task.status !== 'close';
    });
    
    const onScheduleTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate >= today && 
        task.status !== 'done' && 
        task.status !== 'close' && 
        task.status !== 'blocked';
    });
    
    const startedYesterdayTasks = tasks.filter(task => {
      if (!task.actual_start_date) return false;
      const startDate = new Date(task.actual_start_date);
      return startDate.toDateString() === yesterday.toDateString();
    });
    
    // Người không được giao task
    const assignedUserIds = tasks
      .filter(task => task.assignee && task.status !== 'done' && task.status !== 'close')
      .map(task => task.assignee?.userId);
    
    const unassignedUsers = members
      .filter(member => !assignedUserIds.includes(member.user.userId))
      .map(member => member.user.username);
    
    // Khởi tạo object báo cáo
    const reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt'> = {
      reportType: 'daily',
      reportDate: today.toISOString().split('T')[0],
      periodStartDate: yesterday.toISOString().split('T')[0],
      periodEndDate: today.toISOString().split('T')[0],
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      delayedTasks: delayedTasks.length,
      onScheduleTasks: onScheduleTasks.length,
      newStartedTasks: startedYesterdayTasks.length,
      unassignedResources: unassignedUsers,
      totalBugs: 0, // Giả sử chưa có bugs
      criticalBugs: 0,
      majorBugs: 0,
      minorBugs: 0,
      resolvedBugs: 0,
      summary: `Báo cáo ngày ${today.toLocaleDateString('vi-VN')}`,
      tasks: tasks.map(task => transformTaskToReportTask(task))
    };
    
    dispatch(generateDailyReport(reportData as Report));
    
    return reportData;
  };
  
  // Chuyển đổi Task sang ReportTask
  const transformTaskToReportTask = (task: Task): ReportTask => {
    return {
      taskId: task.task_id,
      title: task.title,
      assignee: task.assignee,
      plannedStartDate: task.start_date,
      plannedEndDate: task.due_date,
      actualStartDate: task.actual_start_date,
      actualEndDate: task.actual_end_date,
      status: task.status,
      isDelayed: isTaskDelayed(task),
      delayReason: isTaskDelayed(task) ? 'Chưa xác định' : undefined
    };
  };
  
  // Kiểm tra task có bị trễ không
  const isTaskDelayed = (task: Task): boolean => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    return dueDate < today && 
      task.status !== 'done' && 
      task.status !== 'close';
  };
  
  // Lưu báo cáo hàng ngày vào database
  const saveReport = async () => {
    if (!currentReport) return;
    
    try {
      const reportToSave = {
        ...currentReport,
        projectId: projectId
      };
      
      await dispatch(createReport(reportToSave));
      alert('Báo cáo đã được lưu thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu báo cáo:', error);
      alert('Có lỗi xảy ra khi lưu báo cáo!');
    }
  };
  
  // Tải danh sách báo cáo khi component mount hoặc reportType thay đổi
  useEffect(() => {
    dispatch(fetchProjectReports({ projectId, reportType }));
  }, [dispatch, projectId, reportType]);
  
  // Tự động tạo báo cáo khi component mount
  useEffect(() => {
    if (tasks.length > 0) {
      generateDailyReportFromTasks();
    }
  }, [tasks]);
  
  // Xử lý khi chọn báo cáo từ select
  const handleReportSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const reportId = e.target.value;
    setSelectedReportId(reportId);
    
    // Nếu chọn "Tạo mới", tạo báo cáo từ dữ liệu hiện tại
    if (reportId === 'new') {
      generateDailyReportFromTasks();
    } else {
      // Lấy báo cáo đã được chọn từ danh sách reports
      const selectedReport = reports.find(report => report.id === reportId);
      if (selectedReport) {
        dispatch(generateDailyReport(selectedReport));
      }
    }
  };
  
  // Component loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Component báo lỗi
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-700">
        Lỗi: {error}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header với các điều khiển */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select 
            className="select select-bordered" 
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            aria-label="Loại báo cáo"
          >
            <option value="daily">Báo cáo ngày</option>
            <option value="weekly">Báo cáo tuần</option>
            <option value="monthly">Báo cáo tháng</option>
            <option value="quarterly">Báo cáo quý</option>
          </select>
          
          <select 
            className="select select-bordered" 
            value={selectedReportId || 'new'}
            onChange={handleReportSelect}
            aria-label="Chọn báo cáo"
          >
            <option value="new">Báo cáo mới</option>
            {reports.map(report => (
              <option key={report.id} value={report.id}>
                {new Date(report.reportDate).toLocaleDateString('vi-VN')}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={saveReport}
          disabled={!currentReport}
        >
          Lưu báo cáo
        </button>
      </div>
      
      {/* Nội dung báo cáo */}
      {currentReport ? (
        <div className="space-y-6">
          {/* Thông tin tổng quan */}
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">
                Thông tin tổng quan - {new Date(currentReport.reportDate).toLocaleDateString('vi-VN')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="stat bg-blue-50 rounded-lg p-4">
                  <div className="stat-title">Tổng số công việc</div>
                  <div className="stat-value">{currentReport.totalTasks}</div>
                </div>
                <div className="stat bg-green-50 rounded-lg p-4">
                  <div className="stat-title">Đã hoàn thành</div>
                  <div className="stat-value">{currentReport.completedTasks}</div>
                  <div className="stat-desc">
                    {currentReport.totalTasks > 0 ? 
                      `${Math.round((currentReport.completedTasks / currentReport.totalTasks) * 100)}%` : 
                      '0%'}
                  </div>
                </div>
                <div className="stat bg-red-50 rounded-lg p-4">
                  <div className="stat-title">Bị trễ</div>
                  <div className="stat-value">{currentReport.delayedTasks}</div>
                  <div className="stat-desc">
                    {currentReport.totalTasks > 0 ? 
                      `${Math.round((currentReport.delayedTasks / currentReport.totalTasks) * 100)}%` : 
                      '0%'}
                  </div>
                </div>
                <div className="stat bg-yellow-50 rounded-lg p-4">
                  <div className="stat-title">Đúng tiến độ</div>
                  <div className="stat-value">{currentReport.onScheduleTasks}</div>
                  <div className="stat-desc">
                    {currentReport.totalTasks > 0 ? 
                      `${Math.round((currentReport.onScheduleTasks / currentReport.totalTasks) * 100)}%` : 
                      '0%'}
                  </div>
                </div>
              </div>
              
              {/* Thông tin bổ sung */}
              <div className="mt-4">
                <div className="font-medium">Công việc mới bắt đầu: {currentReport.newStartedTasks}</div>
                {currentReport.unassignedResources.length > 0 && (
                  <div className="font-medium mt-2">
                    Thành viên chưa được giao việc: {currentReport.unassignedResources.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Danh sách công việc trễ hạn */}
          {currentReport.tasks && currentReport.tasks.some(task => task.isDelayed) && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-xl text-red-600">
                  Công việc trễ hạn
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Tên công việc</th>
                        <th>Người thực hiện</th>
                        <th>Hạn hoàn thành</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.tasks
                        .filter(task => task.isDelayed)
                        .map(task => (
                          <tr key={task.taskId}>
                            <td>{task.title}</td>
                            <td>{task.assignee?.username || 'Chưa giao'}</td>
                            <td>
                              {task.plannedEndDate ?
                                new Date(task.plannedEndDate).toLocaleDateString('vi-VN') :
                                'Không có hạn'
                              }
                            </td>
                            <td>
                              <span className={
                                `px-2 py-1 rounded text-white ${
                                  task.status === 'todo' ? 'bg-slate-500' :
                                  task.status === 'doing' ? 'bg-blue-500' :
                                  task.status === 'review' ? 'bg-yellow-500' :
                                  task.status === 'blocked' ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`
                              }>
                                {task.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Công việc đang thực hiện */}
          {currentReport.tasks && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-xl text-blue-600">
                  Công việc đang thực hiện
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Tên công việc</th>
                        <th>Người thực hiện</th>
                        <th>Hạn hoàn thành</th>
                        <th>Tiến độ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.tasks
                        .filter(task => task.status === 'doing' || task.status === 'review')
                        .map(task => (
                          <tr key={task.taskId}>
                            <td>{task.title}</td>
                            <td>{task.assignee?.username || 'Chưa giao'}</td>
                            <td>
                              {task.plannedEndDate ?
                                new Date(task.plannedEndDate).toLocaleDateString('vi-VN') :
                                'Không có hạn'
                              }
                            </td>
                            <td>
                              <div className="relative pt-1">
                                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                                  <div 
                                    style={{ width: `${task.status === 'review' ? 90 : 50}%` }}
                                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                      task.isDelayed ? 'bg-red-500' : 'bg-green-500'
                                    }`}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Công việc hoàn thành hôm qua */}
          {currentReport.tasks && currentReport.tasks.some(task => 
            task.status === 'done' || task.status === 'close'
          ) && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-xl text-green-600">
                  Công việc đã hoàn thành
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Tên công việc</th>
                        <th>Người thực hiện</th>
                        <th>Ngày hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.tasks
                        .filter(task => task.status === 'done' || task.status === 'close')
                        .map(task => (
                          <tr key={task.taskId}>
                            <td>{task.title}</td>
                            <td>{task.assignee?.username || 'Không xác định'}</td>
                            <td>
                              {task.actualEndDate ?
                                new Date(task.actualEndDate).toLocaleDateString('vi-VN') :
                                'Không có dữ liệu'
                              }
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Công việc dự kiến bắt đầu hôm nay */}
          {currentReport.tasks && currentReport.tasks.some(task => {
            if (!task.plannedStartDate) return false;
            const startDate = new Date(task.plannedStartDate);
            const today = new Date();
            return startDate.toDateString() === today.toDateString() &&
              task.status === 'todo';
          }) && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-xl text-purple-600">
                  Công việc dự kiến bắt đầu hôm nay
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Tên công việc</th>
                        <th>Người thực hiện</th>
                        <th>Hạn hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.tasks
                        .filter(task => {
                          if (!task.plannedStartDate) return false;
                          const startDate = new Date(task.plannedStartDate);
                          const today = new Date();
                          return startDate.toDateString() === today.toDateString() &&
                            task.status === 'todo';
                        })
                        .map(task => (
                          <tr key={task.taskId}>
                            <td>{task.title}</td>
                            <td>{task.assignee?.username || 'Chưa giao'}</td>
                            <td>
                              {task.plannedEndDate ?
                                new Date(task.plannedEndDate).toLocaleDateString('vi-VN') :
                                'Không có hạn'
                              }
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Phần bugs - chưa có data thực tế */}
          {currentReport.totalBugs > 0 && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-xl text-orange-600">
                  Bugs & Issues
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="stat bg-red-50 rounded-lg p-4">
                    <div className="stat-title">Critical</div>
                    <div className="stat-value">{currentReport.criticalBugs}</div>
                  </div>
                  <div className="stat bg-orange-50 rounded-lg p-4">
                    <div className="stat-title">Major</div>
                    <div className="stat-value">{currentReport.majorBugs}</div>
                  </div>
                  <div className="stat bg-yellow-50 rounded-lg p-4">
                    <div className="stat-title">Minor</div>
                    <div className="stat-value">{currentReport.minorBugs}</div>
                  </div>
                </div>
                
                {currentReport.bugs && currentReport.bugs.length > 0 && (
                  <div className="overflow-x-auto mt-4">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Tên lỗi</th>
                          <th>Mức độ</th>
                          <th>Trạng thái</th>
                          <th>Người xử lý</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentReport.bugs.map(bug => (
                          <tr key={bug.id}>
                            <td>{bug.title}</td>
                            <td>
                              <span className={`px-2 py-1 rounded text-white ${
                                bug.severity === 'critical' ? 'bg-red-600' :
                                bug.severity === 'major' ? 'bg-orange-500' :
                                'bg-yellow-500'
                              }`}>
                                {bug.severity}
                              </span>
                            </td>
                            <td>
                              <span className={`px-2 py-1 rounded text-white ${
                                bug.status === 'open' ? 'bg-red-500' :
                                bug.status === 'in_progress' ? 'bg-blue-500' :
                                bug.status === 'resolved' ? 'bg-green-500' :
                                'bg-gray-500'
                              }`}>
                                {bug.status}
                              </span>
                            </td>
                            <td>{bug.assignee?.username || 'Chưa giao'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Ghi chú tổng kết */}
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">
                Ghi chú tổng kết
              </h2>
              
              <textarea 
                className="textarea textarea-bordered w-full h-32" 
                placeholder="Nhập ghi chú cho báo cáo này..."
                value={currentReport.summary || ''}
                onChange={(e) => {
                  if (currentReport) {
                    dispatch(generateDailyReport({
                      ...currentReport,
                      summary: e.target.value
                    }));
                  }
                }}
              ></textarea>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">
            Không có dữ liệu báo cáo
          </div>
        </div>
      )}
    </div>
  );
} 