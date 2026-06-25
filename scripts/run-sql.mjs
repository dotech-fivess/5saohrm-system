// Chạy một file .sql lên Postgres của Supabase.
// Dùng: DATABASE_URL="postgresql://..." node scripts/run-sql.mjs supabase/setup.sql
import fs from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
const file = process.argv[2];

if (!file) {
  console.error("Thiếu đường dẫn file .sql");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
// Nếu có DATABASE_URL thì dùng; nếu không, pg tự đọc PGHOST/PGUSER/PGPASSWORD/...
const client = new pg.Client(
  url
    ? { connectionString: url, ssl: { rejectUnauthorized: false } }
    : { ssl: { rejectUnauthorized: false } }
);

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: đã chạy ${file}`);
} catch (e) {
  console.error("LỖI SQL:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
