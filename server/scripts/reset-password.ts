#!/usr/bin/env node
// Usage: npx tsx scripts/reset-password.ts <email>
// Generates a one-time password reset token for the given user.
// Run inside Docker: docker exec openbin npx tsx scripts/reset-password.ts <email>

import { query } from '../src/db.js';
import { createPasswordResetToken } from '../src/lib/passwordReset.js';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/reset-password.ts <email>');
    process.exit(1);
  }

  const result = await query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = $1',
    [email.toLowerCase()],
  );

  if (result.rows.length === 0) {
    console.error(`Error: User "${email}" not found.`);
    process.exit(1);
  }

  const user = result.rows[0];
  const { rawToken, expiresAt } = await createPasswordResetToken(user.id, null);

  console.log(`\nPassword reset token generated for "${user.email}".\n`);
  console.log(`Token: ${rawToken}`);
  console.log(`Expires: ${expiresAt}\n`);
  console.log(`Give the user this link:`);
  console.log(`  <your-domain>/reset-password?token=${rawToken}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
