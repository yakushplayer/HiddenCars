import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const login = process.env.ADMIN_LOGIN || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123';

if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function seed() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `
      INSERT INTO admins (login, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `,
      [login, hash]
    );
    console.log(`Admin ready: login="${login}" password="${password}"`);
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
