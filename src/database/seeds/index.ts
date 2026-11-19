/* eslint-disable no-console */
import 'dotenv/config';
import { db } from '@/database';
import { passwordService } from '@/apps/auth/password.service';
import { Role, Tier } from '@/database/generated/prisma/enums';
import { userRepository } from '@/apps/users/user.repository';
async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }

  if (await userRepository.getUserByEmail(email)) {
    console.log('Admin user already exists, skipping');
    return;
  }

  await userRepository.createUser({
    name: 'Platform Admin',
    email,
    password: await passwordService.hash(password),
    role: Role.ADMIN,
    tier: Tier.ENTERPRISE,
  });
  console.log(`Admin user created: ${email}`);
}

seedAdminUser()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
