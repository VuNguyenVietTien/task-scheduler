import React, { useState, ReactNode } from 'react';
import { Task } from '@/types/task';

interface TabsLayoutProps {
  task: Task;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabComponents: {
    [key: string]: ReactNode;
  };
}

export default function TabsLayout({
  task,
  activeTab,
  setActiveTab,
  tabComponents
}: TabsLayoutProps) {
  const tabs = [
    { id: 'description', label: 'Mô tả' },
    { id: 'details', label: 'Thông tin chi tiết' },
    { id: 'comments', label: 'Bình luận' },
    { id: 'subtasks', label: 'Công việc con' }
  ];

  return (
    <div className="mt-4">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-4">
        {tabComponents[activeTab]}
      </div>
    </div>
  );
} 