# Vercel + Supabase Migration Research

## 1. Vercel Serverless Limits & Rust Backend Impact

**Function Timeout:**
- Hobby: 10s (too tight for complex operations)
- Pro: 60s (workable for most backends)
- Fluid Compute (Pro/Enterprise): up to 800s (for long-running jobs)

**Payload Limits:** 4.5MB request/response. Data-heavy operations exceed this.

**Cold Start:** Not explicitly detailed, but Firebase client initialization takes measurable time. Caching clients between invocations critical.

**Memory:** Configurable on Pro+. Higher memory = faster CPU for Node.js, but no direct tuning for Rust binaries.

**Problem for Rust Migration:** Serverless functions expect ~50-100ms startup. Rust binaries are heavier than Node.js, may hit timeout on cold starts. Solution: Pre-warm instances or use Fluid Compute for batch operations.

---

## 2. Firebase Cloud Messaging from Vercel Serverless

**Feasibility:** YES, Firebase Admin SDK works in Vercel functions.

**Gotchas:**
- **Client Initialization Overhead:** Creating Firebase client each invocation → timeout risk. Mitigate: Reuse singleton client via module-level imports (Node.js caches module singletons between function invocations within same execution context).
- **Cold Starts:** First call slower (~1-2s), subsequent calls faster (~50-100ms).
- **Example Pattern:**
```typescript
// app/api/send-notification/route.ts
import * as admin from 'firebase-admin';

const app = admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY!)),
});

export async function POST(req: Request) {
  try {
    const messaging = admin.messaging(app);
    await messaging.send({ /* ... */ });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
```
**Best Practice:** Initialize Firebase app once at module level, reuse across function invocations.

---

## 3. File Uploads: Supabase Storage vs Vercel Blob

| Aspect | Supabase Storage | Vercel Blob |
|--------|------------------|------------|
| **Best For** | Docs, small files, integration w/ DB | Large images/videos, edge distribution |
| **Max File** | Configurable | No hard limit (multipart for large) |
| **Pricing** | Cheaper per GB initially | $0.15/GB after 100GB free |
| **Client Uploads** | No egress charges for uploads | No egress charges |
| **CDN Integration** | Via Supabase CDN | Automatic Vercel CDN |
| **Cold Start** | SDK init in function | Fast, built-in |

**Recommendation for Supabase-centric stack:** Use Supabase Storage for DBintegrated files (avatars, documents). Use Vercel Blob for media library/backups if storing > 100GB. For 10MB upload limit: both support it.

**Implementation:**
```typescript
// Use Supabase for small, relational files
const { data, error } = await supabase.storage
  .from('documents')
  .upload(path, file);

// Use Vercel Blob for large/frequent uploads
import { put } from '@vercel/blob';
const blob = await put(filename, file, { access: 'public' });
```

---

## 4. Next.js App Router Architecture for Large API Surface

**Key Separation:**
- **Route Handlers** (`/app/api/[...].ts`): External HTTP APIs, webhooks, explicit control
- **Server Actions** (in components/forms): Internal mutations from React, type-safe, no serialization

**Auth Strategy (CRITICAL):**
- Middleware checks auth at edge → routing decisions
- **ALSO** verify auth in every route handler (401 vs 403 status codes matter)
- Don't rely on middleware alone

**Error Handling Pattern:**
```typescript
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const result = await service.create(data);
    return Response.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Middleware Setup (matcher):**
```typescript
export const config = {
  matcher: '/api/:function*'
};

export function middleware(request: NextRequest) {
  const token = request.headers.get('authorization');
  if (!token) return new NextResponse('Unauthorized', { status: 401 });
  // Continue
}
```

**Organizing Many Routes:** Use consistent folder structure:
```
app/api/
├── auth/
│   ├── login/route.ts
│   └── refresh/route.ts
├── documents/
│   ├── route.ts          # GET/POST
│   └── [id]/
│       ├── route.ts      # GET/PATCH/DELETE
│       └── comments/route.ts
└── _middleware.ts        # Shared auth
```

**CORS:** Export OPTIONS handler per route, or use middleware for app-wide CORS.

---

## 5. Monorepo → Single App Migration Pattern

**Architecture:** Move multiple backend services into single Next.js deployment.

**Shared Utilities:**
```typescript
// packages/shared/
├── database/
│   ├── client.ts      # Singleton Supabase client
│   └── queries.ts     # Reusable SQL
├── auth/
│   ├── middleware.ts
│   └── verify-token.ts
└── types/
    └── index.ts       # Shared TS interfaces
```

**Database Client Pattern (avoid connection pool exhaustion):**
```typescript
// packages/shared/database/client.ts
import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }
  return client;
}
```

**Route Organization (ex: move 3 backend services into Next.js):**
```
app/api/
├── service-a/
│   ├── route.ts
│   └── [id]/route.ts
├── service-b/
│   ├── route.ts
│   └── [id]/route.ts
└── service-c/
    └── route.ts
```

**Migration Steps:**
1. Extract shared logic (auth, db, validation) → `packages/shared`
2. Create `/app/api/service-x` routes matching old service endpoints
3. Re-point clients from old URLs to new Next.js routes
4. Deploy as single Vercel app (1 build, 1 deployment)
5. Remove old backend services once proven stable

**Build/Deploy:**
- Turborepo: Caches builds across packages, fast rebuilds
- Single Vercel deployment: All routes in one app (no multi-zone complexity)
- Shared env vars in `.env.local` (or Vercel dashboard)

---

## Summary

| Topic | Decision |
|-------|----------|
| **Rust → Vercel** | Use Pro+ (60s) or Fluid Compute (800s). Cold start risk; pre-warm or batch. |
| **FCM** | Feasible. Singleton client init at module level. ~50-100ms latency per send. |
| **File Uploads** | Supabase Storage for integrated files. Vercel Blob for media library scale. |
| **API Design** | Separate Route Handlers (external) from Server Actions (internal). Middleware + per-handler auth. |
| **Monorepo** | Use Turborepo. Extract shared libs. Single Next.js deployment. Migrate incrementally. |

---

## Sources

- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Serverless Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)
- [Vercel Storage Options](https://vercel.com/docs/storage)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js Middleware](https://nextjs.org/docs/14/app/building-your-application/routing/middleware)
- [Next.js Security Best Practices](https://www.authgear.com/post/nextjs-security-best-practices)
- [Next.js Monorepo](https://blog.logrocket.com/build-monorepo-next-js/)
- [UI Bakery: Vercel vs Supabase 2026](https://uibakery.io/blog/vercel-vs-supabase)
- [Vercel Blob vs Supabase Storage](https://www.buildmvpfast.com/compare/supabase-vs-vercel)
