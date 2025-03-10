'use client';

import { useTasks } from '@/hooks/useTasks';
import { PriorityTaskList } from '@/components/timeline/PriorityTaskList';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();
  const router = useRouter();

  // This is now handled by middleware, but keeping it as a fallback
  if (!user) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.name}!</h1>
        <p className="text-gray-600">Here's an overview of your tasks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tasks Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Priority Tasks</h2>
            <div className="h-[400px]">
              <PriorityTaskList tasks={tasks || []} />
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="mt-1 h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {tasks?.slice(0, 5).map(task => (
                  <div key={task.id} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <span className={`
                        text-xs px-2 py-1 rounded-full
                        ${task.status === 'done' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                        }
                      `}>
                        {task.status?.replace('_', ' ') || 'pending'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{task.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
