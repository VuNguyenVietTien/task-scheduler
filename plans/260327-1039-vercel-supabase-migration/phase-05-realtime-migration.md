# Phase 05: Real-time & WebSocket Migration

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 03](./phase-03-task-scheduler-migration.md), [Phase 04](./phase-04-design-doc-migration.md)
- Research: [GraphQL + Supabase Realtime](./research/researcher-01-graphql-supabase.md)

## Overview
- **Date**: 2026-03-27
- **Priority**: P2
- **Status**: complete
- **Effort**: 4h
- **Description**: Replace custom WebSocket notification system with Supabase Realtime. Set up Postgres Changes listeners for tasks and notifications, Broadcast channels for live updates.

## Key Insights
- Current WebSocket: `NotificationBroadcaster` + `WebSocketState` for real-time notifications
- Supabase Realtime provides: Postgres Changes, Broadcast, Presence — all over WebSocket
- No custom server needed; Supabase manages the connection layer
- Client subscribes directly via Supabase JS client
- Enable Realtime on tables via Supabase dashboard (Publications)

## Requirements

### Functional
- Task status changes push to connected clients in real-time
- New notifications appear without page refresh
- Notification read status syncs across tabs/devices
- Design document changes broadcast to collaborators

### Non-Functional
- Notification delivery latency < 500ms
- Automatic reconnection on connection loss
- No impact on serverless function architecture (client-side only)

## Architecture

```
Frontend (Browser)
├── Supabase Realtime Client
│   ├── Channel: notifications-{userId}
│   │   └── Postgres Changes: INSERT on notifications WHERE user_id = userId
│   ├── Channel: project-{projectId}
│   │   └── Postgres Changes: UPDATE on tasks WHERE project_id = projectId
│   └── Channel: document-{documentId}
│       └── Broadcast: design doc collaboration events
```

### What Replaces What

| Current (Rust WebSocket) | New (Supabase Realtime) |
|--------------------------|------------------------|
| `NotificationBroadcaster` | Postgres Changes on `notifications` table |
| `WebSocketState` (connection tracking) | Supabase Presence (automatic) |
| Custom ping/pong | Built-in heartbeat |
| Manual reconnection logic | Auto-reconnect with backoff |
| Server-side broadcast after DB insert | DB trigger fires Realtime automatically |

## Related Code Files

### Create
- `web/src/hooks/use-realtime-notifications.ts` - Hook for notification subscriptions
- `web/src/hooks/use-realtime-tasks.ts` - Hook for task update subscriptions
- `web/src/hooks/use-realtime-document.ts` - Hook for design doc collaboration
- `web/src/lib/supabase/realtime.ts` - Realtime channel factory/helpers

### Modify
- `web/src/components/` - Components using WebSocket → use new hooks
- `web/src/lib/supabase/client.ts` - Ensure realtime enabled in client config

### Delete (Phase 7)
- `backend/src/websocket/` - Entire WebSocket module
- Frontend WebSocket connection code

## Implementation Steps

### Step 1: Enable Realtime on Tables (0.5h)

1. **Supabase Dashboard** → Realtime → Publications
   - Enable on `notifications` table (INSERT, UPDATE)
   - Enable on `tasks` table (UPDATE)
   - Enable on `documents` table (UPDATE) — for design doc collaboration

2. **SQL alternative** (for reproducibility):
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
   ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
   ALTER PUBLICATION supabase_realtime ADD TABLE documents;
   ```

### Step 2: Create Realtime Hooks (2h)

1. **use-realtime-notifications.ts**
   ```typescript
   export function useRealtimeNotifications(userId: string) {
     const supabase = createBrowserClient();
     const [notifications, setNotifications] = useState<Notification[]>([]);

     useEffect(() => {
       const channel = supabase.channel(`notifications-${userId}`)
         .on('postgres_changes', {
           event: 'INSERT',
           schema: 'public',
           table: 'notifications',
           filter: `user_id=eq.${userId}`
         }, (payload) => {
           setNotifications(prev => [payload.new as Notification, ...prev]);
         })
         .subscribe();

       return () => { supabase.removeChannel(channel); };
     }, [userId]);

     return notifications;
   }
   ```

2. **use-realtime-tasks.ts**
   - Subscribe to task updates within a project
   - Filter by `project_id`
   - Update local task state on changes (integrate with existing Redux store)

3. **use-realtime-document.ts**
   - Broadcast channel for design doc collaboration
   - Track active editors via Presence
   - Broadcast cursor/selection events (future use)

### Step 3: Create Realtime Helpers (0.5h)

1. **realtime.ts** - Factory for creating typed channels
   ```typescript
   export function createNotificationChannel(supabase: SupabaseClient, userId: string) {
     return supabase.channel(`notifications-${userId}`)
       .on('postgres_changes', { /* config */ }, callback);
   }
   ```

### Step 4: Integrate with Existing Components (1h)

1. Replace WebSocket connection setup in layout/providers
2. Update notification bell component to use `useRealtimeNotifications`
3. Update task board/list views to use `useRealtimeTasks`
4. Remove old WebSocket client code
5. Update Redux store to handle realtime events (dispatch actions on Supabase events)

## Todo List
- [ ] Enable Realtime publications on notifications, tasks, documents tables
- [ ] Create `use-realtime-notifications` hook
- [ ] Create `use-realtime-tasks` hook
- [ ] Create `use-realtime-document` hook
- [ ] Create realtime channel factory helpers
- [ ] Integrate notification hook with notification bell component
- [ ] Integrate task hook with task board/list views
- [ ] Remove old WebSocket client connection code
- [ ] Test real-time notification delivery
- [ ] Test task update propagation
- [ ] Test reconnection after network drop

## Success Criteria
- New notifications appear within 500ms of creation
- Task status changes reflect across all connected clients
- Reconnection works automatically after brief network loss
- No custom WebSocket server needed
- Notification count updates in real-time

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase Realtime connection limits (free tier) | Medium | Monitor concurrent connections; upgrade tier if needed |
| Stale data after reconnection | Medium | Re-fetch on reconnection event; use `getUser()` to verify session |
| Postgres Changes latency spikes | Low | Acceptable for notifications; fallback to polling if severe |

## Security Considerations
- Realtime channels filtered by user ID (RLS applies to Postgres Changes)
- Broadcast channels use authenticated Supabase client
- No sensitive data in broadcast payloads
- Presence only exposes user ID, not profile details

## Next Steps
- Phase 06: Update frontend to use unified GraphQL endpoint + realtime hooks
