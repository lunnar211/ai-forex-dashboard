#!/usr/bin/env node
'use strict';

/**
 * Admin Verification Script
 *
 * This script verifies that the admin user is properly configured.
 * Run this on your Render backend service to debug admin login issues.
 *
 * Usage:
 *   node scripts/verify-admin.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function verifyAdmin() {
  console.log('\n=== Admin User Verification ===\n');

  // Check environment variables
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  console.log('1. Environment Variables Check:');
  console.log(`   ADMIN_EMAIL: ${adminEmail ? '✓ Set' : '✗ NOT SET'}`);
  console.log(`   ADMIN_PASSWORD: ${adminPassword ? '✓ Set' : '✗ NOT SET'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ NOT SET'}`);

  if (!adminEmail || !adminPassword) {
    console.error('\n❌ ERROR: ADMIN_EMAIL or ADMIN_PASSWORD environment variables are not set!');
    console.error('   Please set these in your Render dashboard under Environment variables.\n');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ ERROR: DATABASE_URL environment variable is not set!\n');
    process.exit(1);
  }

  console.log('\n2. Database Connection Check:');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query('SELECT 1');
    console.log('   ✓ Database connection successful');
  } catch (err) {
    console.error(`   ✗ Database connection failed: ${err.message}\n`);
    process.exit(1);
  }

  console.log('\n3. Admin User Check:');

  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, is_blocked, created_at FROM users WHERE email = $1',
      [adminEmail.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log(`   ✗ Admin user does not exist in database`);
      console.log(`   → Creating admin user now...`);

      const hashed = await bcrypt.hash(adminPassword, 12);
      const insertResult = await pool.query(
        'INSERT INTO users (email, password, name, is_admin) VALUES ($1, $2, $3, TRUE) RETURNING id, email, name, is_admin, created_at',
        [adminEmail.toLowerCase(), hashed, 'Admin']
      );

      const newUser = insertResult.rows[0];
      console.log(`   ✓ Admin user created successfully!`);
      console.log(`      ID: ${newUser.id}`);
      console.log(`      Email: ${newUser.email}`);
      console.log(`      Name: ${newUser.name}`);
      console.log(`      Admin: ${newUser.is_admin}`);
      console.log(`      Created: ${newUser.created_at}`);
    } else {
      const user = result.rows[0];
      console.log(`   ✓ Admin user found in database`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Name: ${user.name || '(none)'}`);
      console.log(`      Admin: ${user.is_admin ? '✓ YES' : '✗ NO'}`);
      console.log(`      Blocked: ${user.is_blocked ? '✗ YES' : '✓ NO'}`);
      console.log(`      Created: ${user.created_at}`);

      // Check if password matches
      console.log('\n4. Password Verification:');
      const passwordResult = await pool.query(
        'SELECT password FROM users WHERE email = $1',
        [adminEmail.toLowerCase()]
      );
      const storedHash = passwordResult.rows[0].password;
      const passwordMatches = await bcrypt.compare(adminPassword, storedHash);

      console.log(`   Password matches: ${passwordMatches ? '✓ YES' : '✗ NO'}`);

      if (!passwordMatches) {
        console.log(`   → Updating password to match environment variable...`);
        const newHash = await bcrypt.hash(adminPassword, 12);
        await pool.query(
          'UPDATE users SET password = $1, is_admin = TRUE WHERE email = $2',
          [newHash, adminEmail.toLowerCase()]
        );
        console.log(`   ✓ Password updated successfully!`);
      }

      // Ensure admin flag is set
      if (!user.is_admin) {
        console.log(`\n   → Granting admin privileges...`);
        await pool.query(
          'UPDATE users SET is_admin = TRUE WHERE email = $1',
          [adminEmail.toLowerCase()]
        );
        console.log(`   ✓ Admin privileges granted!`);
      }

      // Unblock if blocked
      if (user.is_blocked) {
        console.log(`\n   → Unblocking user...`);
        await pool.query(
          'UPDATE users SET is_blocked = FALSE WHERE email = $1',
          [adminEmail.toLowerCase()]
        );
        console.log(`   ✓ User unblocked!`);
      }
    }

    console.log('\n✅ Admin user is properly configured!\n');
    console.log('You can now log in at:');
    console.log('   https://ai-forex-frontend.onrender.com/admin');
    console.log(`   Email: ${adminEmail}`);
    console.log('   Password: (use the value set in ADMIN_PASSWORD env var)\n');

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyAdmin();
