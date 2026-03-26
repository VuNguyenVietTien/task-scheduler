# Test Commands for Task Scheduler API

## Testing Steps
1. Start server with `cargo run`
2. Create a project and save its ID
3. Use the ID to test other endpoints
4. Use `jq` to format JSON output

## Test Commands

### 1. Get All Projects (Empty at first)
```bash
curl -X GET "http://localhost:8080/api/projects" \
-H "Content-Type: application/json" | jq
```

### 2. Create Test Project
```bash
# Save the response to get project ID
PROJECT_ID=$(curl -X POST "http://localhost:8080/api/projects" \
-H "Content-Type: application/json" \
-d '{
    "name": "Test Project",
    "description": "A test project",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "visibility": "PUBLIC",
    "category": "Testing",
    "progress": 0
}' | jq -r '.id')

echo "Created project ID: $PROJECT_ID"
```

### 3. Get Project by ID
```bash
curl -X GET "http://localhost:8080/api/projects/$PROJECT_ID" \
-H "Content-Type: application/json" | jq
```

### 4. Get Tasks by Project ID
```bash
curl -X GET "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/tasks" \
-H "Content-Type: application/json" | jq
```

### 5. Get Project Members
```bash
curl -X GET "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/members" \
-H "Content-Type: application/json" | jq
```

## Sample One-liner to Run All Tests
```bash
# Run all commands in sequence
echo "=== Testing All APIs ===" && \
echo -e "\n1. Get All Projects:" && \
curl -s -X GET "http://localhost:8080/api/projects" -H "Content-Type: application/json" | jq && \
echo -e "\n2. Create Project:" && \
PROJECT_ID=$(curl -s -X POST "http://localhost:8080/api/projects" -H "Content-Type: application/json" -d '{"name":"Test Project","description":"A test project","status":"IN_PROGRESS","priority":"HIGH","visibility":"PUBLIC","category":"Testing","progress":0}' | jq -r '.id') && \
echo "Created Project ID: $PROJECT_ID" && \
echo -e "\n3. Get Project Details:" && \
curl -s -X GET "http://localhost:8080/api/projects/$PROJECT_ID" -H "Content-Type: application/json" | jq && \
echo -e "\n4. Get Project Tasks:" && \
curl -s -X GET "http://localhost:8080/api/projects/$PROJECT_ID/tasks" -H "Content-Type: application/json" | jq && \
echo -e "\n5. Get Project Members:" && \
curl -s -X GET "http://localhost:8080/api/projects/$PROJECT_ID/members" -H "Content-Type: application/json" | jq
```

## Notes
- All authentication has been temporarily disabled for testing
- Server must be running on localhost:8080
- Requires `jq` installed for JSON formatting
- Use `-s` flag with curl for silent mode in scripts