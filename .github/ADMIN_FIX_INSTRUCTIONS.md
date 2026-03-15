# How to Fix Admin Panel Access

## Your Credentials

Set the following in the Render dashboard — do **not** hardcode them in any file:

```
ADMIN_EMAIL=<your admin email>
ADMIN_PASSWORD=<your admin password>
```

## Step-by-Step Fix

### Step 1: Open Render Dashboard
Go to: https://dashboard.render.com

### Step 2: Find Your Backend Service
Look for a service named: **ai-forex-backend**
Click on it.

### Step 3: Go to Environment Tab
In the left sidebar, click **Environment**

### Step 4: Add Admin Email
1. Click **Add Environment Variable**
2. In the "Key" field, type: `ADMIN_EMAIL`
3. In the "Value" field, enter your admin email address.
4. Click **Save**

### Step 5: Add Admin Password
1. Click **Add Environment Variable** again
2. In the "Key" field, type: `ADMIN_PASSWORD`
3. In the "Value" field, enter your chosen admin password.
   - **Important**: Type it exactly as you want it set.
   - If your password contains special characters, try wrapping it in single quotes when using a shell.
4. Click **Save**

### Step 6: Wait for Redeploy
Render will automatically redeploy your backend service.
This takes about 2-3 minutes.
You'll see a progress indicator at the top of the page.

### Step 7: Check the Logs
1. Click **Logs** in the left sidebar
2. Wait for the deployment to finish
3. Look for this line in the logs:
   ```
   [DB] Admin user seeded.
   ```
   OR
   ```
   [DB] Admin user already exists — verified admin flag.
   ```

If you see either of these messages, you're good to go!

### Step 8: Test Your Login
1. Open a new browser tab
2. Go to: https://ai-forex-frontend.onrender.com/admin
3. Enter:
   - Email: the value you set for `ADMIN_EMAIL` in Render
   - Password: the value you set for `ADMIN_PASSWORD` in Render
4. Click **Sign In to Admin Panel**

You should now see the admin dashboard!

## What You'll See in Admin Panel

After successful login:
- List of all registered users
- Statistics (total users, predictions, active users)
- Activity logs (logins, registrations)
- Ability to create, block, or delete users

## Troubleshooting

### If You See "Invalid email or password"

**Problem**: Environment variables might not be set correctly

**Solutions**:
1. Double-check the spelling of `ADMIN_EMAIL` and `ADMIN_PASSWORD` (exact match)
2. Make sure there are no extra spaces before or after the values
3. Try wrapping the password in single quotes: `'YourAdminPassword123!'`
4. Restart the backend service manually:
   - Go to backend service dashboard
   - Click **Manual Deploy** → **Deploy latest commit**

### If You See "Access denied. Admin privileges required"

**Problem**: User exists but doesn't have admin privileges

**Solution**:
1. Make sure `ADMIN_EMAIL` exactly matches your email (case-sensitive)
2. Restart the backend service - it will automatically fix the admin flag
3. Check logs for the "Admin user" message

### If Nothing Works

**Last Resort Options**:

1. **Try a Simpler Password**:
   - Change `ADMIN_PASSWORD` to: `TempAdmin123!`
   - Restart backend
   - Test login
   - Change to a secure password after confirming it works

2. **Check Database Directly**:
   - Go to your **forex-db** database on Render
   - Click **Connect** tab
   - Use a PostgreSQL client to connect
   - Run: `SELECT * FROM users WHERE email = '<your ADMIN_EMAIL value>';`
   - Verify `is_admin` column is TRUE

3. **Contact Support**:
   - If all else fails, you may have a Render-specific issue
   - Check Render's status page
   - Review backend service logs for errors

## Screenshots Guide

### Where to Find Environment Variables
```
Render Dashboard
  └── Your Backend Service (ai-forex-backend)
      └── Left Sidebar
          └── Environment ← Click here
              └── Add Environment Variable button
```

### Where to Check Logs
```
Render Dashboard
  └── Your Backend Service (ai-forex-backend)
      └── Left Sidebar
          └── Logs ← Click here
              └── Real-time log stream appears
```

### Where to Manually Deploy
```
Render Dashboard
  └── Your Backend Service (ai-forex-backend)
      └── Top Right Corner
          └── Manual Deploy button
              └── Click "Deploy latest commit"
```

## Security Reminder

After confirming admin access works:
1. Consider changing your password to something even more secure
2. Never share your admin credentials
3. Log out when not using the admin panel
4. Regularly monitor the activity logs for suspicious behavior

## Need More Help?

See these guides:
- [QUICK_FIX.md](../QUICK_FIX.md) - Fast reference card
- [ADMIN_SETUP.md](../ADMIN_SETUP.md) - Detailed troubleshooting guide
- [RENDER_DEPLOYMENT_CHECKLIST.md](../RENDER_DEPLOYMENT_CHECKLIST.md) - Full deployment checklist
