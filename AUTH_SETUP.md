# KhataBot Authentication Setup

## Overview
KhataBot uses Supabase phone + password authentication. User registration is disabled - users must be created via Supabase admin panel or API.

## Login Flow
1. User enters 10-digit phone number (e.g., `9876543210`)
2. System formats to `+919876543210`
3. User enters password
4. System validates against Supabase using `signInWithPassword(email: phoneWithCountry, password)`

## Creating Users in Supabase

### Option 1: Supabase Dashboard (Easiest)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** > **Users**
4. Click **Create new user**
5. Fill in:
   - **Email**: `+919876543210` (use full phone with +91)
   - **Password**: Set a password
   - Click **Create user**

### Option 2: SQL Query

In Supabase SQL Editor, run:

```sql
-- Create auth user with phone as email
SELECT auth.create_user(
  email := '+919876543210',
  password := 'SecurePassword123',
  email_confirmed := true
);
```

### Option 3: Supabase API

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H 'apikey: YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "+919876543210",
    "password": "SecurePassword123",
    "email_confirmed": true
  }'
```

## User Profile Setup (Optional)

After creating auth user, you can add profile data:

```sql
-- Create user profile in public.user_profiles
INSERT INTO public.user_profiles (id, phone_number, display_name, created_at, updated_at)
VALUES (
  'USER_UUID_FROM_AUTH',
  '+919876543210',
  'John Doe',
  NOW(),
  NOW()
);
```

## Testing Login

1. Visit `http://localhost:3000/auth/login`
2. Enter phone number: `9876543210` (or with formatting like `98-7654-3210`)
3. Enter password you set in Supabase
4. Click Login
5. Should redirect to dashboard if successful

## Common Issues

### "Invalid login credentials"
- User doesn't exist in Supabase
- Password is incorrect
- Phone number format issue (should be exactly 10 digits)

### "Email not confirmed"
- User was created without email confirmation
- Solution: Create user with `email_confirmed: true` or confirm manually in dashboard

### Can't access dashboard after login
- Auth context might not be initialized
- Check browser console for errors
- Verify Supabase environment variables in .env.local

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Auth Context

The app uses `AuthProvider` which:
- Checks for active session on page load
- Auto-redirects logged-in users from auth pages to dashboard
- Auto-redirects unauthenticated users from dashboard to login
- Provides `useAuth()` hook for accessing current user

## Security Notes

- Never use anon key for creating/deleting users in production
- Use Service Role Key only in secure backend contexts
- Passwords should be at least 8 characters
- Phone numbers are stored in Supabase auth as email field
