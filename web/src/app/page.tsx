'use client';

import { useState, useEffect } from 'react';
import tasksData from '@/data/tasks.json';
import { Task } from '@/types/task';

interface Notification {
  id: string;
  type: 'comment' | 'deadline' | 'overdue' | 'status';
  message: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  projectId: string;
  taskId: string;
}

export default function Home() {
  const [tasks] = useState<Task[]>(tasksData as Task[]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Simulate fetching notifications
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'overdue',
        message: 'Project Alpha has 3 overdue tasks',
        timestamp: new Date().toISOString(),
        priority: 'high',
        projectId: 'proj-1',
        taskId: 'task-1'
      },
      {
        id: '2',
        type: 'comment',
        message: 'New comment on "API Integration"',
        timestamp: new Date().toISOString(),
        priority: 'medium',
        projectId: 'proj-1',
        taskId: 'task-2'
      },
      {
        id: '3',
        type: 'deadline',
        message: 'Frontend deployment due in 2 days',
        timestamp: new Date().toISOString(),
        priority: 'high',
        projectId: 'proj-2',
        taskId: 'task-3'
      }
    ];
    setNotifications(mockNotifications);
  }, []);

  const getNotificationStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'alert alert-error';
      case 'medium':
        return 'alert alert-warning';
      default:
        return 'alert alert-success';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'comment':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'deadline':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <section className="mb-8">
        <h1>Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Priority Notifications */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="mb-4">Priority Alerts</h2>
              <div className="space-y-4">
                {notifications.map(notification => (
                  <div key={notification.id} className={getNotificationStyle(notification.priority)}>
                    <div className="flex items-center">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1">
                        <p className="font-medium">{notification.message}</p>
                        <p className="text-sm text-text-secondary mt-1">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="btn-primary w-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Task
              </button>
              <button className="btn-secondary w-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Timer
              </button>
              <button className="btn-secondary w-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Task Statistics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <h3 className="text-text-secondary">Tasks Due Today</h3>
          <p className="text-3xl font-bold text-primary">5</p>
        </div>
        <div className="card">
          <h3 className="text-text-secondary">Overdue Tasks</h3>
          <p className="text-3xl font-bold text-error">3</p>
        </div>
        <div className="card">
          <h3 className="text-text-secondary">In Progress</h3>
          <p className="text-3xl font-bold text-warning">8</p>
        </div>
        <div className="card">
          <h3 className="text-text-secondary">Completed Today</h3>
          <p className="text-3xl font-bold text-success">12</p>
        </div>
      </section>
    </div>
  );
}
