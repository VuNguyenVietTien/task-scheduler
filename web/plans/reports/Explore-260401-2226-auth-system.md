# Authentication System Exploration Report

## Project: ProjectManager/web
**Date:** April 1, 2026  
**Status:** Complete

---

## 1. LOGOUT BUTTON & FUNCTIONALITY

### Primary Logout Button Location
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/ui/navigation/Header.tsx`
- **Line:** 67-75 (handleLogout function)
- **Line:** 122-139 (Account dropdown button)

**Secondary Logout in Dropdown:**
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/ui/navigation/AccountDropdown.tsx`
- **Line:** 32-37 (Sign out button)

### Current Logout Logic
```typescript
// Line 67-75 in Header.tsx
const handleLogout = async () => {
  // TODO: Implement logout functionality
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

**Status:** Logout redirects to `/login` (but auth system uses `/auth` route)

### Backend Logout Endpoint
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/app/api/auth/logout/route.ts`
- **Lines:** 1-31
- **Action:** Clears `auth-token` and `user-session` cookies
- **Response:** Returns `{ success: true, message: 'Logged out successfully' }`

---

## 2. PROFILE DROPDOWN & OPTIONS

### Profile Dropdown Component
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/ui/navigation/AccountDropdown.tsx`

### Profile Dropdown Menu Items
1. **Settings** (Line 25-30)
   - Triggers settings panel modal
   - Translation key: `profile.settings`
   - Icon: Gear/cog SVG

2. **Sign Out** (Line 32-37)
   - Red colored text (`text-red-600`)
   - Translation key: `profile.signOut`
   - Calls `onLogout` callback

### Profile Button
**Location:** Header.tsx, Lines 123-132
- **Avatar:** Gray circle with person icon
- **Trigger:** Toggles AccountDropdown visibility
- Shows user icon (not actual user photo)

---

## 3. AUTHENTICATION SYSTEM USED

### Multi-Backend Architecture
**Primary:** Supabase Auth (email/password, email verification)  
**Secondary:** Firebase Auth (Google OAuth only)

### Authentication Flow
1. **Firebase → Google OAuth** (web-based popup)
2. **Backend sync** via `/api/auth/firebase/login`
3. **Supabase session** established with OTP
4. **Local state** updated and redirect to dashboard

---

## 4. LOGIN/AUTH ROUTES

### Auth Page Location
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/app/auth/page.tsx`
- **Route:** `/auth`
- **Type:** Client-side component
- **Features:**
  - Toggle between Login and Registration
  - Email/password form
  - Google Sign-In button
  - Email verification page when `?verifyEmail=true`

### Related Routes
- `/auth` - Main auth page
- `/auth?verifyEmail=true` - Email verification reminder
- `/dashboard` - Post-login redirect

---

## 5. FIREBASE AUTH CONFIGURATION

### Firebase Config Location
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/lib/firebase.ts`
- **Lines:** 12-20

### Firebase Environment Variables (from `.env.local.example`)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=  (optional)
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=  (optional)
NEXT_PUBLIC_FIREBASE_APP_ID=  (optional)
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=  (optional)
```

### Firebase Initialization
- **Guard:** Only initializes if `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` are configured
- **Safety:** Returns `null` gracefully if not configured
- **Lazy Loading:** Avoids Firebase init on server-side

### Configured Auth Methods
**Only Google OAuth is configured:**
```typescript
// Line 60 in firebase.ts
const googleProvider = new GoogleAuthProvider();

// Lines 62-68: Google sign-in function
export async function signInWithGoogle() {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) throw new Error('Google login is not configured on this deployment.');
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { token: idToken, user: result.user };
}
```

---

## 6. AUTH UTILITY FILES

### Main Auth Context
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/contexts/AuthContext.tsx`
- **Lines:** 1-249
- **Type:** React Context + Provider
- **Methods:**
  - `login()` - Email/password via Supabase
  - `register()` - Email/password via Supabase
  - `loginWithGoogle()` - Firebase → Supabase sync
  - `logout()` - Sign out from both Firebase + Supabase
  - `sendVerificationEmail()` - Email verification
  - `checkAuth()` - Session validation

### Auth Hook
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/hooks/useAuth.ts`
- **Lines:** 1-10
- **Purpose:** Wrapper around AuthContext
- **Error:** Throws if used outside AuthProvider

### Auth API Utilities
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/lib/authApi.ts`
- **Supabase browser client functions:**
  - `registerUser()` - Email/password registration
  - `loginUser()` - Email/password login
  - `logoutUser()` - Sign out
  - `getCurrentUser()` - Fetch current user

### Firebase Admin
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/lib/firebase-admin.ts`
- Server-side Firebase token verification

---

## 7. GOOGLE SIGN-IN IMPLEMENTATION

### Frontend Flow (AuthContext.tsx, Lines 83-149)
```
1. User clicks "Continue with Google" button
2. signInWithGoogle() triggers Firebase popup
3. Firebase returns idToken + firebaseUser
4. POST to /api/auth/firebase/login with:
   - firebase_token (idToken)
   - email
   - name (displayName or 'Unnamed User')
   - firebase_uid
5. Backend verifies token server-side
6. Creates/fetches user in Supabase
7. Generates magic link session
8. Returns user data + session
9. Client establishes Supabase session
10. Redirect to /dashboard
```

### Backend Verification (Firebase Login Route)
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/app/api/auth/firebase/login/route.ts`
- **Lines:** 17-22: Server-side Firebase token verification
- **Lines:** 29-75: User creation/lookup in Supabase
- **Lines:** 77-107: Supabase session magic link generation

### Key Points
- Token validated against Firebase credentials (line 19-21)
- User synced to Supabase DB if not exists (lines 42-74)
- Magic link created for session (lines 90-108)
- Cookies set for auth-token and user-session (lines 125-130)

---

## 8. IMPORTANT ISSUES FOUND

### Issue 1: Logout Redirect Mismatch
**In Header.tsx line 71:**
```typescript
window.location.href = '/login';  // ❌ Should be '/auth'
```
- Auth system uses `/auth` route, not `/login`
- This will cause 404 after logout

### Issue 2: AuthContext Import Inconsistency
**Header.tsx (ui/navigation) imports from:**
```typescript
import { useAuth } from '@/hooks/useAuth';  // ✓ Correct
```

**But /app/auth/page.tsx imports from:**
```typescript
import { useAuth } from '@/hooks/useAuth';  // ✓ Also correct
```

**Actually both correct** - `useAuth` hook wraps the context properly.

### Issue 3: Missing AuthProvider
**Providers location:** `/Users/TienVNV/Desktop/ProjectManager/web/src/components/providers/`
- Need to verify AuthProvider is wrapped in ClientProviders

---

## 9. USER DATA STRUCTURE

### User Interface
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/types/auth.ts`

### User in AuthContext
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
  providerData: ProviderData[];
}
```

### Provider Data
```typescript
interface ProviderData {
  providerId: string;      // e.g., 'google.com'
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}
```

---

## 10. SESSION MANAGEMENT

### Session Validation
**File:** `/Users/TienVNV/Desktop/ProjectManager/web/src/app/api/auth/me/route.ts`
- **Lines:** 6-50
- **Method:** GET request
- **Process:**
  1. Reads `auth-token` and `user-session` cookies
  2. Parses user-session JSON
  3. Returns user data if both cookies exist
  4. Returns 401 if cookies missing

### Session Check in AuthContext
**Lines:** 59-81 in AuthContext.tsx
- Called on app init
- Runs `checkAuth()` in useEffect
- Auto-redirects to dashboard if on /auth page
- Shows loading spinner during check

---

## FILE INVENTORY

| Purpose | File Path | Lines |
|---------|-----------|-------|
| Auth Context & Provider | `/src/contexts/AuthContext.tsx` | 1-249 |
| useAuth Hook | `/src/hooks/useAuth.ts` | 1-10 |
| Auth Types | `/src/types/auth.ts` | N/A |
| Firebase Config | `/src/lib/firebase.ts` | 1-109 |
| Supabase Auth API | `/src/lib/authApi.ts` | 1-87 |
| Firebase Admin | `/src/lib/firebase-admin.ts` | N/A |
| Auth Page | `/src/app/auth/page.tsx` | 1-227 |
| Logout Endpoint | `/src/app/api/auth/logout/route.ts` | 1-31 |
| Firebase Login Endpoint | `/src/app/api/auth/firebase/login/route.ts` | 1-138 |
| Current User Endpoint | `/src/app/api/auth/me/route.ts` | 1-51 |
| Header Component | `/src/components/ui/navigation/Header.tsx` | 1-149 |
| Account Dropdown | `/src/components/ui/navigation/AccountDropdown.tsx` | 1-43 |
| Layout | `/src/components/ui/navigation/Layout.tsx` | 1-29 |

---

## SUMMARY

### What's Working
✓ Firebase Google OAuth integration  
✓ Supabase email/password auth  
✓ Server-side token verification  
✓ Multi-backend sync  
✓ Session cookies (auth-token, user-session)  
✓ Settings modal in profile dropdown  

### What Needs Fixing
✗ Logout redirect to `/login` instead of `/auth`  
✗ AccountDropdown shows generic user icon (no photo)  
✗ Header.tsx has TODO comment for logout implementation  

### Environment Variables Needed
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---
