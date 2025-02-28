# Frontend Pre-Release Fixes

## High Priority

- [ ] Fix auth route static generation issues:
  - Update `/api/auth/me` route to handle cookies properly with Next.js 14 
  - Add proper dynamic route segment configs in route.ts files

- [ ] Replace `<img>` tags with Next.js `Image` component in:
  - `src/components/tasks/TaskCard.tsx`
  - `src/components/tasks/TaskListView.tsx`
  - `src/components/timeline/TaskTooltip.tsx`

- [ ] Resolve Jest configuration:
  - Remove `jest.config.js`
  - Keep only `jest.config.mjs`

## Code Cleanup

- [ ] Fix unused variables:
  - Remove unused 'cookies' imports in auth routes
  - Clean up unused props in components
  - Add underscore prefix to intentionally unused parameters

- [ ] Install and configure ESLint Testing Library rules:
  ```bash
  npm install --save-dev eslint-plugin-testing-library
  ```
  - Add proper configuration to .eslintrc.json

## Performance Improvements

- [ ] Ensure proper TypeScript version compatibility:
  - Update TypeScript to a version officially supported by @typescript-eslint
  - Update @typescript-eslint dependencies

- [ ] Optimize bundle sizes:
  - Review and optimize large pages (e.g., /projects/[id] at 22.5kB)
  - Consider code splitting for large components

## Testing

- [ ] Fix and run all tests after making above changes
- [ ] Verify all auth flows work correctly
- [ ] Test performance on different devices/browsers

## Documentation

- [ ] Update README with:
  - Development setup instructions
  - Testing instructions
  - Build/deployment process
  - Known limitations/issues
