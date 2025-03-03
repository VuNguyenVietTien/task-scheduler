# Testing Guide for API Changes

## Setup
1. Restart backend server:
```bash
cd task-scheduler-backend
cargo run
```

2. Ensure frontend is running:
```bash
cd task-scheduler-frontend
npm run dev
```

## API Testing Steps

### 1. Project Detail View
1. Navigate to any project detail page
2. Open browser DevTools -> Network tab
3. Expected behavior:
   - Single request to `/api/projects/{id}`
   - Request includes credentials
   - Response status 200
   - Log shows project data

### 2. Project Tasks
1. Stay on project detail page
2. Watch Network tab
3. Expected behavior:
   - Single request to `/api/projects/{id}/tasks`
   - No duplicate requests
   - Request includes credentials
   - Response status 200 or 404 if no tasks
   - Log shows task data or empty array

### 3. Project Members
1. Stay on project detail page
2. Watch Network tab
3. Expected behavior:
   - Single request to `/api/projects/{id}/members`
   - No duplicate requests
   - Request includes credentials
   - Response status 200 or 404 if no members
   - Log shows member data or empty array

### 4. Caching Test
1. Navigate away from project page
2. Return to same project page within 30 seconds
3. Expected behavior:
   - No new API requests for project/tasks/members
   - Data loaded from cache
   - Check backend logs - should not see new requests

### 5. Backend Logs
Check backend console for:
1. Request received logs
2. Auth validation logs
3. Database operation logs
4. Response sent logs
5. No duplicate logs for same request

### 6. Frontend Logs
Check browser console for:
1. API request details
2. Response data logs
3. No error messages
4. No duplicate requests

## Common Issues
1. 404 errors:
   - Check route configuration in mod.rs
   - Verify scope prefixes in tasks.rs and project_members.rs

2. Duplicate requests:
   - Check useQuery configuration
   - Verify staleTime and cacheTime settings

3. Missing auth:
   - Verify credentials being sent
   - Check Auth middleware configuration

## Success Criteria
- All API endpoints return correct status codes
- No duplicate API calls
- Complete logging coverage
- Proper error handling
- Caching works as expected