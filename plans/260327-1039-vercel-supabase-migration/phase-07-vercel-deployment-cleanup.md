# Phase 07: Vercel Deployment & Cleanup

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: All previous phases (1-6)

## Overview
- **Date**: 2026-03-27
- **Priority**: P2
- **Status**: complete
- **Effort**: 4h
- **Description**: Configure Vercel project, set environment variables, remove old Rust services and Docker configs, update documentation, run smoke tests.

## Key Insights
- Single Vercel deployment replaces: 2 Rust backends + Docker Compose + Nginx
- Vercel Pro plan required for 60s timeout on GraphQL endpoint
- Environment variables set in Vercel dashboard (not committed)
- Existing frontend already deployable on Vercel; API routes are the addition

## Requirements

### Functional
- Application deploys and runs on Vercel
- All API routes accessible from deployed frontend
- Environment variables correctly configured
- Old services removed from repository

### Non-Functional
- Deploy time < 5 minutes
- Cold start < 3s for GraphQL endpoint
- All smoke tests pass on deployed environment

## Architecture

### Vercel Configuration

```
vercel.json (if needed)
{
  "functions": {
    "app/api/graphql/route.ts": {
      "maxDuration": 60
    },
    "app/api/media/upload/route.ts": {
      "maxDuration": 30
    }
  }
}
```

### Environment Variables (Vercel Dashboard)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Related Code Files

### Create
- `web/vercel.json` - Function configuration (timeouts, regions)

### Modify
- `web/next.config.js` - Ensure no conflicting config for Vercel
- `web/package.json` - Verify build script works for Vercel
- Documentation files in `docs/`

### Delete
- `backend/` - Entire Rust task-scheduler backend
- `design-doc-service/` - Entire Rust design-doc backend
- `docker-compose.yml` (if exists)
- `Dockerfile` files for backends
- `nginx.conf` (if exists)
- Any CI/CD configs referencing Rust builds

## Implementation Steps

### Step 1: Vercel Project Configuration (1h)

1. **Create/configure Vercel project**
   ```bash
   cd frontend && npx vercel link
   ```

2. **Create `vercel.json`**:
   - Set `maxDuration: 60` for `/api/graphql`
   - Set appropriate region (closest to Supabase DB)
   - Configure any rewrites if needed

3. **Set environment variables** in Vercel dashboard:
   - All Supabase keys (preview + production)
   - Firebase service account key
   - App URL per environment

4. **Verify `next.config.js`** compatibility:
   - No `output: 'standalone'` (conflicts with Vercel)
   - No custom server configuration
   - Image domains configured for Supabase Storage URLs

### Step 2: Pre-deployment Validation (1h)

1. **Local build test**:
   ```bash
   cd frontend && npm run build
   ```

2. **Type checking**:
   ```bash
   npx tsc --noEmit
   ```

3. **Bundle analysis** (optional):
   ```bash
   ANALYZE=true npm run build
   ```
   - Verify GraphQL bundle < 1MB
   - Check for unnecessary Rust-era dependencies

4. **Test all API routes locally**:
   - GraphQL queries/mutations via GraphiQL
   - Auth endpoints
   - File upload/download
   - Notification push

### Step 3: Deploy & Smoke Test (1h)

1. **Deploy to Vercel**:
   ```bash
   npx vercel --prod
   ```

2. **Smoke test checklist**:
   - [ ] Login with email/password
   - [ ] Login with Firebase OAuth
   - [ ] Load project list (GraphQL)
   - [ ] Load task board (GraphQL)
   - [ ] Create/update task
   - [ ] Upload file attachment
   - [ ] Receive real-time notification
   - [ ] Load design documents
   - [ ] Create/edit screen
   - [ ] SVG paste and display
   - [ ] Password reset flow
   - [ ] Logout and session cleanup

3. **Monitor Vercel logs** for errors:
   - Function timeouts
   - Cold start times
   - Error rates

### Step 4: Remove Old Services & Cleanup (1h)

1. **Remove backend directories**:
   ```bash
   rm -rf backend/
   rm -rf design-doc-service/
   ```

2. **Remove Docker/deployment configs**:
   - `docker-compose.yml`
   - `Dockerfile` files
   - `nginx.conf`
   - CI/CD pipeline configs for Rust builds

3. **Update documentation**:
   - `docs/system-architecture.md` - New Vercel + Supabase architecture
   - `docs/deployment-guide.md` - Vercel deployment instructions
   - `docs/codebase-summary.md` - Reflect single-app architecture
   - `docs/development-roadmap.md` - Mark migration as complete
   - `docs/project-changelog.md` - Record migration

4. **Update root files**:
   - Remove Rust-related entries from `.gitignore`
   - Update `package.json` scripts (if monorepo scripts exist)
   - Remove `Cargo.toml` / `Cargo.lock` references

5. **Clean up frontend**:
   - Remove unused dependencies (`npm prune`)
   - Remove old API URL configs
   - Remove any environment variables pointing to old backends

## Todo List
- [ ] Link Vercel project
- [ ] Create vercel.json with function configs
- [ ] Set all environment variables in Vercel dashboard
- [ ] Verify next.config.js compatibility
- [ ] Run local build successfully
- [ ] Run type checking with no errors
- [ ] Deploy to Vercel preview
- [ ] Run full smoke test on preview
- [ ] Deploy to production
- [ ] Run full smoke test on production
- [ ] Remove backend/ directory
- [ ] Remove design-doc-service/ directory
- [ ] Remove Docker/Nginx configs
- [ ] Update system-architecture.md
- [ ] Update deployment-guide.md
- [ ] Update codebase-summary.md
- [ ] Update development-roadmap.md
- [ ] Update project-changelog.md
- [ ] Remove unused dependencies
- [ ] Final type check and build verification

## Success Criteria
- Application deploys to Vercel without errors
- All smoke tests pass on production
- No references to old Rust backends in codebase
- Documentation reflects new architecture
- Build time < 5 minutes
- GraphQL cold start < 3s
- No 500 errors in first 24 hours of production

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Vercel build fails (missing deps, types) | High | Test build locally first; fix all type errors |
| Environment variables misconfigured | High | Double-check all vars; use Vercel preview deploy first |
| Cold starts too slow for users | Medium | Optimize bundle; consider Vercel Pro cron ping |
| Removing backends breaks something missed | Medium | Deploy new version first; keep old backends running 1 week |

## Security Considerations
- Verify no secrets in committed code (scan with `git-secrets` or similar)
- Ensure `SUPABASE_SERVICE_ROLE_KEY` not in any `NEXT_PUBLIC_*` variable
- Remove any hardcoded API URLs pointing to old backends
- Update CORS settings for Vercel domain
- Verify RLS policies work in production

## Next Steps
- Monitor production for 1 week
- Address any performance issues (cold starts, timeouts)
- Consider Vercel Pro features (fluid compute, analytics)
- Archive old backend documentation
