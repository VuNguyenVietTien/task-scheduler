import React from 'react';
import { OverviewTab } from '../components/project/OverviewTab';
import { TasksTab } from '../components/project/TasksTab';
import { MembersTab } from '../components/project/MembersTab';

const tabs = [
  { label: 'Overview', component: <OverviewTab /> },
  { label: 'Tasks', component: <TasksTab /> },
  { label: 'Members', component: <MembersTab /> },
]; 