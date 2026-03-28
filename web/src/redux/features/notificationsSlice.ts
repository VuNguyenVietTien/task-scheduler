import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { client as apolloClient } from '@/lib/apollo-client';
import { 
  GET_NOTIFICATIONS, 
  GET_NOTIFICATION_COUNT 
} from '@/graphql/queries/notifications';
import { 
  MARK_NOTIFICATION_AS_READ, 
  MARK_ALL_NOTIFICATIONS_AS_READ 
} from '@/graphql/mutations/notifications';
import type { Notification, BackendNotification, NotificationCount } from '@/types/notification';

// Define slice state interface
interface NotificationsState {
  items: Notification[];
  count: {
    total: number;
    unread: number;
  };
  loading: boolean;
  error: string | null;
}

// Convert backend notification format to frontend format
const convertBackendNotification = (notification: BackendNotification): Notification => {
  return {
    id: notification.notification_id || '',
    userId: notification.user_id,
    message: notification.message,
    type: ((notification as any).type_ || notification.type) as any,
    isRead: notification.is_read,
    createdAt: notification.created_at,
    projectId: notification.project_id,
    taskId: notification.reference_type === 'TASK' ? notification.reference_id : undefined,
    commentId: notification.reference_type === 'COMMENT' ? notification.reference_id : undefined,
    senderId: notification.sender_id,
    metadata: notification.metadata
  };
};

// Initial state
const initialState: NotificationsState = {
  items: [],
  count: {
    total: 0,
    unread: 0
  },
  loading: false,
  error: null
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apolloClient.query({
        query: GET_NOTIFICATIONS,
        fetchPolicy: 'network-only'
      });
      
      const notifications = data.notifications || [];
      return notifications.map(convertBackendNotification);
    } catch (error: any) {
      console.error('[Redux] Error fetching notifications:', error);
      return rejectWithValue(error.message || 'Failed to fetch notifications');
    }
  }
);

export const fetchNotificationCount = createAsyncThunk(
  'notifications/fetchNotificationCount',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apolloClient.query({
        query: GET_NOTIFICATION_COUNT,
        fetchPolicy: 'network-only'
      });
      
      return data.notification_count || { total: 0, unread: 0 };
    } catch (error: any) {
      console.error('[Redux] Error fetching notification count:', error);
      return rejectWithValue(error.message || 'Failed to fetch notification count');
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      await apolloClient.mutate({
        mutation: MARK_NOTIFICATION_AS_READ,
        variables: { notificationId }
      });
      
      return notificationId;
    } catch (error: any) {
      console.error('[Redux] Error marking notification as read:', error);
      return rejectWithValue(error.message || 'Failed to mark notification as read');
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await apolloClient.mutate({
        mutation: MARK_ALL_NOTIFICATIONS_AS_READ
      });
      
      return true;
    } catch (error: any) {
      console.error('[Redux] Error marking all notifications as read:', error);
      return rejectWithValue(error.message || 'Failed to mark all notifications as read');
    }
  }
);

// Create the slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Check if notification already exists to prevent duplicates
      const exists = state.items.some(n => n.id === action.payload.id);
      if (!exists) {
        console.log('[Redux] Adding new notification to store:', action.payload.id);
        state.items.unshift(action.payload);
        state.count.total += 1;
        if (!action.payload.isRead) {
          state.count.unread += 1;
        }
      } else {
        console.log('[Redux] Notification already exists in store, skipping:', action.payload.id);
      }
    },
    clearAllNotifications: (state) => {
      state.items = [];
      state.count = { total: 0, unread: 0 };
    },
    updateNotificationReadStatus: (state, action: PayloadAction<{id: string, isRead: boolean}>) => {
      const { id, isRead } = action.payload;
      const notification = state.items.find(n => n.id === id);
      if (notification) {
        // If status is changing from unread to read, decrement unread count
        if (!notification.isRead && isRead) {
          state.count.unread = Math.max(0, state.count.unread - 1);
        }
        // If status is changing from read to unread, increment unread count
        else if (notification.isRead && !isRead) {
          state.count.unread += 1;
        }
        notification.isRead = isRead;
      }
    },
    clearErrors: (state) => {
      state.error = null;
    },
    incrementUnreadCount: (state) => {
      state.count.unread += 1;
      state.count.total += 1;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchNotifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        
        // Merge new notifications with existing ones, avoiding duplicates
        const existingIds = new Set(state.items.map(item => item.id));
        const newItems = action.payload.filter((item: Notification) => !existingIds.has(item.id));
        
        // Update existing notifications with server data (keeping read state in sync)
        const updatedExisting = state.items.map(existing => {
          const serverItem = action.payload.find((item: Notification) => item.id === existing.id);
          return serverItem ? { ...existing, ...serverItem } : existing;
        });
        
        // Set the items with updated existing and new ones
        state.items = [...updatedExisting, ...newItems];
        
        // Recalculate counts
        state.count.total = state.items.length;
        state.count.unread = state.items.filter(item => !item.isRead).length;
        
        console.log('[Redux] Updated notifications store with server data. Total:', state.count.total, 'Unread:', state.count.unread);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // fetchNotificationCount
      .addCase(fetchNotificationCount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotificationCount.fulfilled, (state, action) => {
        state.loading = false;
        state.count = action.payload;
      })
      .addCase(fetchNotificationCount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // markNotificationAsRead
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notificationId = action.payload;
        const notification = state.items.find(n => n.id === notificationId);
        if (notification && !notification.isRead) {
          notification.isRead = true;
          state.count.unread = Math.max(0, state.count.unread - 1);
        }
      })
      
      // markAllNotificationsAsRead
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.items.forEach(notification => {
          notification.isRead = true;
        });
        state.count.unread = 0;
      });
  }
});

// Export actions and reducer
export const { 
  addNotification, 
  updateNotificationReadStatus, 
  clearAllNotifications,
  clearErrors,
  incrementUnreadCount
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

// Selectors
export const selectNotifications = (state: { notifications: NotificationsState }) => state.notifications.items;
export const selectNotificationCount = (state: { notifications: NotificationsState }) => state.notifications.count;
export const selectNotificationsLoading = (state: { notifications: NotificationsState }) => state.notifications.loading;
export const selectNotificationsError = (state: { notifications: NotificationsState }) => state.notifications.error;