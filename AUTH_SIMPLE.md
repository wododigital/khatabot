# KhataBot Authentication - Simple Email + Password

## How It Works

Users login with **Email** + **Password** via standard Supabase authentication.

### Login Form
```
Email: user@example.com
Password: SecurePassword123
↓
Validates against Supabase Auth
↓
If valid → Redirect to Dashboard
If invalid → Show error message
```

---

## Creating Users

Users must be created in Supabase by an admin. No self-signup available.

### Option 1: Supabase Dashboard (Easiest)

1. Go to **Authentication > Users**
2. Click **Create new user**
3. Fill in:
   - **Email**: `user@example.com`
   - **Password**: `SecurePassword123`
4. Click **Create user**

### Option 2: SQL Query

```sql
SELECT auth.create_user(
  email := 'user@example.com',
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
    "email": "user@example.com",
    "password": "SecurePassword123",
    "email_confirmed": true
  }'
```

---

## Testing Login

1. **Create a user** in Supabase with email `test@khatabot.app` and password `TestPass123`
2. **Go to login page**: `http://localhost:3000/auth/login`
3. **Enter:**
   - Email: `test@khatabot.app`
   - Password: `TestPass123`
4. **Click Login**
5. **Should redirect to dashboard** ✅

---

## Features

✅ Email validation (must be valid email format)
✅ Password required (no minimum length enforced on form)
✅ Loading state while authenticating
✅ Clear error messages
✅ Auto-redirect to dashboard if already logged in
✅ Auto-redirect to login if accessing protected pages
✅ Logout button in top navigation

---

## User Profile (Optional)

If you want to store additional user info (display name, phone, etc.), you can use the `user_profiles` table:

```sql
INSERT INTO user_profiles (id, email, display_name, phone_number)
VALUES (
  'USER_UUID_FROM_AUTH',
  'user@example.com',
  'John Doe',
  '+919876543210'
);
```

But for basic auth, you only need the Supabase Auth user.
