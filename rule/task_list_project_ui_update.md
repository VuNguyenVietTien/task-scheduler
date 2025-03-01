# Task List - Project UI Update

## Form Updates
- [x] Remove dueDate and members fields from create project form
- [x] Add priority field with options: LOW, MEDIUM, HIGH, URGENT
- [x] Add visibility field with options: PUBLIC, PRIVATE, TEAM  
- [x] Add tags field with multiple selection
- [x] Set default status to 'NEW' when creating project
- [x] Update form validation schema

## Project Card Updates
- [x] Add member count display
- [x] Show project priority with appropriate color indicator
- [x] Display project status with badge
- [x] Show project tags
- [x] Improve card design for better visualization

## API Integration
- [x] Update project creation API to handle new fields (API already supports all fields)
- [ ] Add API endpoint for closing project (updating end date)
- [ ] Update project list API to include member count
- [ ] Handle project status updates

## Testing
- [ ] Test project creation with new fields
- [ ] Test project card display
- [ ] Test project status updates
- [ ] Test member count calculation

## Remaining Tasks
1. Cần thêm API endpoint để đóng project và cập nhật end date
2. Cần thêm tính năng đếm số lượng member trong project và trả về qua API
3. Cần thêm chức năng update status của project (NEW -> IN_PROGRESS -> COMPLETED)