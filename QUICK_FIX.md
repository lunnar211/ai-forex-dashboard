# Quick Fix for Admin Panel Access

## Your Credentials

Use the values you set in the Render dashboard:
- Email: the value of `ADMIN_EMAIL` (set in Render environment variables)
- Password: the value of `ADMIN_PASSWORD` (set in Render environment variables)

## Steps to Fix (5 minutes)

### 1. Go to Render Backend Service
Visit: https://dashboard.render.com

Find your service named: **ai-forex-backend**

### 2. Add Environment Variables

Click on your backend service, then:
- Click **Environment** in the left sidebar
- Click **Add Environment Variable**

Add these two variables:

**Variable 1:**
```
Key: ADMIN_EMAIL
Value: <your admin email address>
```

**Variable 2:**
```
Key: ADMIN_PASSWORD
Value: <your admin password>
```

**IMPORTANT:** When entering the password, type it exactly as you configured it in the Render dashboard. If your password contains special characters such as `$`, try wrapping the value in single quotes when using a shell.

### 3. Save and Deploy

After adding both variables:
1. Click **Save Changes**
2. Render will automatically redeploy your backend
3. Wait 2-3 minutes for the deployment to complete

### 4. Check Logs

Once deployment is done:
1. Click **Logs** in the left sidebar
2. Look for this message:
   ```
   [DB] Admin user seeded.
   ```
   OR
   ```
   [DB] Admin user already exists — verified admin flag.
   ```
   OR
   ```
   [DB] Admin user already exists — verified admin flag and synced password.
   ```

If you see either message, you're good to go!

### 5. Test Login

Go to: https://ai-forex-frontend.onrender.com/admin

Enter:
- Email: the value you set for `ADMIN_EMAIL` in Render
- Password: the value you set for `ADMIN_PASSWORD` in Render

Click **Sign In to Admin Panel**

## Still Not Working?

### Option A: Check for Special Character Issues

If your password contains special characters (e.g. `$`, `!`, `@`), they may cause issues in shell contexts. Try these alternatives:

1. In Render environment variables, wrap the password in single quotes if using the shell:
   ```
   ADMIN_PASSWORD='YourStrongPassword!'
   ```

2. Or temporarily change to a simpler password like:
   ```
   ADMIN_PASSWORD=TempAdmin123!
   ```

### Option B: Run Verification Script

If you have SSH access to Render or can run commands:

```bash
cd backend
npm run verify-admin
```

This script will:
- Check if environment variables are set
- Verify database connection
- Check if admin user exists
- Create or update the admin user
- Verify password matches

### Option C: Manual Database Fix

As a last resort, connect to your PostgreSQL database directly:

1. Go to your **forex-db** database on Render
2. Click **Connect** tab
3. Use the connection string to connect via a PostgreSQL client
4. Run this query to verify admin status:
   ```sql
   SELECT id, email, is_admin, is_blocked FROM users
   WHERE email = '<your ADMIN_EMAIL value>';
   ```
5. If `is_admin` is FALSE, run:
   ```sql
   UPDATE users SET is_admin = TRUE, is_blocked = FALSE
   WHERE email = '<your ADMIN_EMAIL value>';
   ```

## Need More Help?

See the detailed guide: [ADMIN_SETUP.md](ADMIN_SETUP.md)
