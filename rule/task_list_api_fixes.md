# API Fixes Implementation Tasks

## Frontend Changes
- [x] Add apiUtils.ts with common API configurations
- [x] Create useCommonApi hook for reusable API logic
- [x] Update useProjectTasks hook:
  - [x] Use common API configurations
  - [x] Add caching with staleTime
  - [x] Disable refetchOnWindowFocus
  - [x] Add retry config
- [x] Update useProjectMembers hook:
  - [x] Use common API configurations
  - [x] Add caching with staleTime
  - [x] Disable refetchOnWindowFocus
  - [x] Add retry config
- [x] Ensure credentials are included in all requests

## Backend Changes
- [x] Update route structure in mod.rs:
  - [x] Add /api prefix at root level
  - [x] Configure Auth middleware correctly
  - [x] Remove duplicate /api prefixes from sub-modules

- [x] Fix tasks.rs endpoints:
  - [x] Update route configuration to work with /api prefix
  - [x] Add comprehensive logging
  - [x] Fix DateTime type conversions
  - [x] Ensure proper error handling

- [x] Fix project_members.rs endpoints:
  - [x] Update route configuration to work with /api prefix
  - [x] Add comprehensive logging
  - [x] Fix DateTime type conversions
  - [x] Ensure proper error handling

## Documentation
- [x] Create project_endpoints.md with:
  - [x] Complete API route structure
  - [x] Authentication details
  - [x] Frontend integration notes
  - [x] Logging configurations

## Testing Tasks
- [ ] Test all endpoints with Postman/cURL:
  - [ ] GET /api/projects/{id}
  - [ ] GET /api/projects/{id}/tasks
  - [ ] GET /api/projects/{id}/members
- [ ] Verify logging output:
  - [ ] Frontend request/response logs
  - [ ] Backend operation logs
- [ ] Check API caching behavior:
  - [ ] Verify staleTime works
  - [ ] Verify refetchOnWindowFocus disabled