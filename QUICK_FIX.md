# Quick Fix for Admin Panel Access

## Your Credentials
- Email: `dipeshkarki6612@gmail.com`
- Password: `Mac@2019$$`

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
Value: dipeshkarki6612@gmail.com
```

**Variable 2:**
```
Key: ADMIN_PASSWORD
Value: Mac@2019$$
```

**IMPORTANT:** When entering the password, type it exactly as shown including the double `$$` at the end. If you have issues, try wrapping it in single quotes: `'Mac@2019$$'`

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

If you see either message, you're good to go!

### 5. Test Login

Go to: https://ai-forex-frontend.onrender.com/admin

Enter:
- Email: `dipeshkarki6612@gmail.com`
- Password: `Mac@2019$$`

Click **Sign In to Admin Panel**

## Still Not Working?

### Option A: Check for Special Character Issues

The `$$` in your password might be causing issues. Try these alternatives:

1. In Render environment variables, wrap the password in single quotes:
   ```
   ADMIN_PASSWORD='Mac@2019$$'
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
   WHERE email = 'dipeshkarki6612@gmail.com';
   ```
5. If `is_admin` is FALSE, run:
   ```sql
   UPDATE users SET is_admin = TRUE, is_blocked = FALSE
   WHERE email = 'dipeshkarki6612@gmail.com';
   ```

## Need More Help?

See the detailed guide: [ADMIN_SETUP.md](ADMIN_SETUP.md)
