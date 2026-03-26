# Firebase Setup Instructions

## 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name
4. Enable Google Analytics (optional)
5. Create project

## 2. Enable Authentication Methods
1. In Firebase Console, go to "Authentication" > "Sign-in method"
2. Enable "Email/Password" provider
3. Enable "Google" provider
4. Add authorized domains for your app

## 3. Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Under "General" tab, scroll to "Your apps"
3. Click the web icon (</>)
4. Register your app with a nickname
5. Copy the Firebase configuration object

## 4. Configure Environment Variables
Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 5. Set Up Email Templates (Optional)
1. Go to "Authentication" > "Templates"
2. Customize:
   - Email verification
   - Password reset
   - Email change

## 6. Security Rules
Update Firebase Authentication security rules:

1. Go to "Authentication" > "Security Rules"
2. Set up rules for email verification requirements
3. Configure session duration

Example rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.token.email_verified == true;
    }
  }
}
```

## Testing Authentication
1. Create a test account using email/password
2. Test email verification flow
3. Test Google sign-in
4. Verify user data in Firebase Console
5. Test account creation in backend database

## Troubleshooting
Common issues and solutions:

1. **Email verification not working**
   - Check spam folder
   - Verify email templates
   - Check Firebase console logs

2. **Google sign-in fails**
   - Verify authorized domains
   - Check OAuth configuration
   - Ensure correct origin settings

3. **Backend registration fails**
   - Check Firebase token validation
   - Verify API endpoint configuration
   - Check CORS settings
