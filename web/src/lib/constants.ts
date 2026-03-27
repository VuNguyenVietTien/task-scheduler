// Task enums are defined in src/types/task.ts
// Use TaskStatuses and Priorities from there instead

export const ProjectStatuses = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ON_HOLD: 'on-hold'
} as const;

export const ProjectPriorities = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
} as const;

export const ProjectVisibilities = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  TEAM: 'TEAM'
} as const;