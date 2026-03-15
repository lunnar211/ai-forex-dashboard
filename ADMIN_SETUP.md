# Admin Panel Setup Guide

## Issue
The admin panel at https://ai-forex-frontend.onrender.com/admin requires proper environment variable configuration on the backend.

## Solution

### Step 1: Set Environment Variables on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Find your **ai-forex-backend** service
3. Click on it, then go to **Environment** in the left sidebar
4. Add or update these environment variables:

```
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-secure-password
```

**IMPORTANT:** When entering the password, make sure to type it exactly. If it contains special characters such as `$`, wrap the value in single quotes in shell contexts but enter the raw value in the Render UI.

### Step 2: Restart the Backend Service

After setting the environment variables:
1. Go to the **Manual Deploy** section
2. Click **Deploy latest commit** or use the **Restart** button
3. Wait for the deployment to complete (this may take 2-3 minutes)

### Step 3: Verify Admin User Creation

After the backend restarts, check the logs:
1. Go to your backend service on Render
2. Click on **Logs** in the left sidebar
3. Look for one of these messages:
   - `[DB] Admin user seeded.` (first time setup)
   - `[DB] Admin user already exists — verified admin flag.` (subsequent restarts)

### Step 4: Test Admin Login

1. Go to https://ai-forex-frontend.onrender.com/admin
2. Enter:
   - Email: the `ADMIN_EMAIL` you configured
   - Password: the `ADMIN_PASSWORD` you configured
3. Click **Sign In to Admin Panel**

## Troubleshooting

### If you still see "Invalid email or password"

The password might have special character issues. Here's what to check:

1. **Check for escaping issues**: If the password contains `$`, it might be interpreted as a shell variable
2. **Solution**: In Render's environment variables, try wrapping the value in single quotes in shell contexts, but enter the raw value directly in the Render UI

### If you see "Access denied. Admin privileges required"

This means the user exists but doesn't have admin privileges. To fix:

1. Check that `ADMIN_EMAIL` exactly matches the email you entered in Render's environment variables
2. Restart the backend service again
3. The `seedAdmin` function will automatically grant admin privileges

### If nothing works

As a last resort, you can manually create the admin user via Render's PostgreSQL dashboard:

1. Go to your **forex-db** database on Render
2. Click **Connect** → **External Connection**
3. Use a PostgreSQL client (like pgAdmin or TablePlus) to connect
4. Run this SQL:

```sql
-- First, check if user exists
SELECT id, email, is_admin FROM users WHERE email = 'your-admin@example.com';

-- If user exists but is_admin is FALSE, update it:
UPDATE users SET is_admin = TRUE WHERE email = 'your-admin@example.com';

-- If user doesn't exist, you'll need to hash the password first
-- (Better to let the backend app create it via environment variables)
```

## Security Notes

1. After confirming admin access works, consider changing the password to something even more secure
2. Never commit admin credentials to Git
3. The password is hashed using bcrypt with 12 salt rounds before storage
4. Admin sessions expire after 7 days for security
