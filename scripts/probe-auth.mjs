import pg from "pg";
const c = new pg.Client({ ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  select column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema='auth' and table_name='users'
    and is_nullable='NO' and column_default is null
  order by ordinal_position`);
console.log("NOT NULL & no default columns in auth.users:");
for (const row of r.rows) console.log(" -", row.column_name, "(" + row.data_type + ")");
// pgcrypto availability
const ext = await c.query("select extname, extnamespace::regnamespace::text as schema from pg_extension where extname in ('pgcrypto')");
console.log("pgcrypto:", JSON.stringify(ext.rows));
await c.end();
