#!/usr/bin/env node
/**
 * Solar Bunker CRM — First-Administrator Bootstrap Utility
 * 
 * Usage:
 *   node scripts/bootstrap-admin.js <email> <password> "<Full Name>"
 *   or run without arguments for interactive prompt:
 *   node scripts/bootstrap-admin.js
 */

import dotenv from 'dotenv';
import readline from 'readline';
import { createCrmUser, getAdminCount, isSupabaseConfigured } from '../server/db.js';

dotenv.config();

function ask(question, isPassword = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`🛡️  Solar Bunker CRM — First Administrator Setup`);
  console.log(`======================================================\n`);

  if (!isSupabaseConfigured) {
    console.error('❌ Error: Supabase connection is not configured in .env');
    process.exit(1);
  }

  const existingAdmins = await getAdminCount();
  if (existingAdmins > 0) {
    console.log(`ℹ️  Note: There are currently ${existingAdmins} active administrator account(s) registered.`);
  } else {
    console.log(`✨ No administrator accounts registered. Initializing first administrator.`);
  }

  const args = process.argv.slice(2);
  let email = args[0];
  let password = args[1];
  let name = args[2];

  if (!email) {
    email = await ask('Enter Administrator Email: ');
  }
  if (!password) {
    password = await ask('Enter Administrator Password (min 6 characters): ', true);
  }
  if (!name) {
    name = await ask('Enter Administrator Full Name: ');
  }

  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }
  if (!password || password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters.');
    process.exit(1);
  }

  try {
    console.log(`\nRegistering administrator account for: ${email}...`);
    const result = await createCrmUser({
      email,
      password,
      name: name || email.split('@')[0],
      role: 'admin'
    });

    console.log(`\n======================================================`);
    console.log(`✅ Administrator Account Successfully Initialized!`);
    console.log(`👤 User ID:  ${result.user_id}`);
    console.log(`✉️ Email:    ${result.email}`);
    console.log(`🏷️ Role:     ${result.role.toUpperCase()} (Full Owner Privileges)`);
    console.log(`🔑 Password: [SECURELY STORED VIA BCRYPT / SUPABASE AUTH]`);
    console.log(`======================================================`);
    console.log(`You can now sign in at http://localhost:5173 or in production.\n`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Failed to create administrator:`, err.message);
    process.exit(1);
  }
}

run();
