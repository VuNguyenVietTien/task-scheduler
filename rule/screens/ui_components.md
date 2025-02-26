# UI Components Specification

## New Task Form (NewTaskForm.tsx)
Component để tạo task mới với rich text editor và các trường thông tin đầy đủ.

### Props
```typescript
interface NewTaskFormProps {
  projectId: string;
}
```

### Features
1. Rich Text Editor
   - Toolbar với các chức năng:
     - Text formatting (bold, italic, underline)
     - Headings (H1, H2, H3)
     - Lists (ordered, unordered)
     - Tables
     - Images
     - Links
   - Custom styling phù hợp với theme
   - Responsive design

2. Form Fields
   - Title Input
     - Text input
     - Required validation
     - Max length: 200 characters
   
   - Description (Rich Text)
     - React Quill editor
     - Required validation
     - Supports HTML content
   
   - Assignee Input
     - Text input
     - Required validation
   
   - Deadline Picker
     - Datetime-local input
     - Required validation
     - Future date validation
   
   - Category Select
     - Dropdown menu
     - Predefined options
     - Required validation
   
   - Type Select
     - Dropdown menu
     - Predefined options
     - Required validation
   
   - Tags Selection
     - Checkbox group
     - Multiple selection
     - Max 5 tags limit

3. Form Actions
   - Cancel Button
     - Returns to previous page
     - Prevents accidental data loss
   
   - Submit Button
     - Primary action style
     - Disabled during submission
     - Shows loading state

### Styling
```css
/* Form Container */
.form-container {
  @apply space-y-6 bg-white p-6 rounded-lg shadow;
}

/* Form Fields */
.form-field {
  @apply space-y-4;
}

/* Labels */
.field-label {
  @apply block text-sm font-medium text-gray-700;
}

/* Inputs */
.text-input {
  @apply mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500;
}

/* Rich Text Editor */
.quill {
  @apply mb-4;
}

.ql-toolbar {
  @apply rounded-t-md border-slate-300;
}

.ql-container {
  @apply rounded-b-md border-slate-300 min-h-[200px];
}

/* Buttons */
.primary-button {
  @apply px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500;
}

.secondary-button {
  @apply px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500;
}
```

### Validation Rules
1. Title
   - Required
   - Min length: 1
   - Max length: 200

2. Description
   - Required
   - HTML content allowed

3. Assignee
   - Required
   - String

4. Deadline
   - Required
   - Must be future date
   - ISO datetime format

5. Category
   - Required
   - Must be one of predefined options

6. Type
   - Required
   - Must be one of predefined options

7. Tags
   - Optional
   - Maximum 5 selections

### Error Handling
- Validation errors shown below each field
- Network errors shown as toast notifications
- Form submission blocked if validation fails

### Integration
- Opens in new browser tab via route /projects/[id]/add-task
- Uses TaskFormData type for form data structure
- Integrates with project context for navigation
- Uses global theme variables for styling
