# Test Empty Responses

Sử dụng project ID từ test trước (6dde2542-6827-425c-b8ac-a0475b63c82c):

```bash
# 1. Test tasks endpoint
curl -X GET "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/tasks" \
-H "Content-Type: application/json" | jq

# 2. Test members endpoint
curl -X GET "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/members" \
-H "Content-Type: application/json" | jq

# 3. Create a task for testing
curl -X POST "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/tasks" \
-H "Content-Type: application/json" \
-d '{
    "title": "Test Task",
    "description": "A test task",
    "status": "TODO",
    "priority": "HIGH",
    "effort_hours": 2.5
}' | jq

# 4. Add a member for testing
curl -X POST "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/members" \
-H "Content-Type: application/json" \
-d '{
    "user_id": "7541b39e-4f4f-449e-82a2-ea22e8d6a580",
    "role": "MEMBER"
}' | jq

# 5. Check lists again after adding data
curl -X GET "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/tasks" \
-H "Content-Type: application/json" | jq

curl -X GET "http://localhost:8080/api/projects/6dde2542-6827-425c-b8ac-a0475b63c82c/members" \
-H "Content-Type: application/json" | jq
```

Expected responses:
1. Empty tasks list with success message
2. Empty members list with success message
3. New task created
4. New member added
5. Lists now contain the new items