import { configureStore } from '@reduxjs/toolkit';
import tasksReducer from '../features/tasksSlice';
import projectReducer from '../features/projectSlice';
import membersReducer from '../features/membersSlice';

export const store = configureStore({
  reducer: {
    tasks: tasksReducer,
    project: projectReducer,
    members: membersReducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false, // Disable cho phép lưu trữ non-serializable values trong Redux store
  }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {tasks: TasksState, project: ProjectState, members: MembersState}
export type AppDispatch = typeof store.dispatch; 