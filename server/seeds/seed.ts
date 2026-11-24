import crypto from 'crypto';
import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.ts';
import { seedDatabase } from './seedService.ts';

async function runSeed() {
  const forceFlag = process.argv.includes('--sample');
  if (process.env.SEED_SAMPLE_DATA !== 'true' && !forceFlag) {
    console.log(
      'Skipped: Set SEED_SAMPLE_DATA=true or pass --sample to seed sample HavenStay data.'
    );
    return;
  }

  await connectDB();
  console.log('Connected to MongoDB. Seeding HavenStay PG sample dataset...');

  const envPassword = process.env.SEED_DEFAULT_PASSWORD?.trim();
  const password = envPassword || crypto.randomBytes(12).toString('base64url');
  const summary = await seedDatabase({
    clearExisting: true,
    forceSample: true,
    userPassword: password,
  });

  if (!envPassword) {
    console.log(`Generated one-time seed password for demo accounts: ${password}`);
  }
  console.log('Seed complete!', summary);
  await disconnectDB();
}

runSeed().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDB();
  process.exit(1);
});
