import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { connectDB, disconnectDB } from '../config/db.ts';
import { importRealPgData, realPgImportSchema } from '../services/realImportService.ts';

function parseArg(flag: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.slice(flag.length + 1) : undefined;
}

async function runImport() {
  const jsonFilePath =
    parseArg('--file') || path.resolve(process.cwd(), 'server/data/real-pg-template.json');
  const rulesFilePath =
    parseArg('--rules') || path.resolve(process.cwd(), 'server/data/pg-rules-template.md');
  const replaceExisting = parseArg('--replace') !== 'false';

  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`Import JSON file not found: ${jsonFilePath}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  const validatedData = realPgImportSchema.parse(rawJson);

  let markdownRules: string | undefined;
  if (rulesFilePath && fs.existsSync(rulesFilePath)) {
    markdownRules = fs.readFileSync(rulesFilePath, 'utf8');
  }

  await connectDB();
  console.log(`Connected to MongoDB. Importing real PG data from ${jsonFilePath}...`);

  const summary = await importRealPgData({
    data: validatedData,
    markdownRules,
    replaceExisting,
  });

  console.log('Real PG import complete (admin accounts preserved)!', summary);
  await disconnectDB();
}

runImport().catch(async (err) => {
  console.error('Import failed:', err);
  await disconnectDB();
  process.exit(1);
});
