// Brings the database up to date with prisma/migrations before a production build.
//
// Runs only on Vercel production builds (or when MIGRATE=1), so preview deployments of a pull request never
// change the live tables. The first time, it marks 0_init as already applied, because those tables were made
// with `prisma db push` before this repo had migrations. After that it is a plain `prisma migrate deploy`.
import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const want = process.env.VERCEL_ENV === "production" || process.env.MIGRATE === "1";
if (!want) {
  console.log("migrate: skipped (only production builds change the database)");
  process.exit(0);
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);
const exists = async (table) => (await sql.query("SELECT to_regclass($1) AS t", [`public."${table}"`]))[0].t !== null;
const prisma = (...args) => execFileSync("npx", ["prisma", ...args], { stdio: "inherit", env: { ...process.env, DIRECT_URL: url } });

if (!(await exists("_prisma_migrations")) && (await exists("Group"))) {
  console.log("migrate: existing tables found, marking 0_init as applied");
  prisma("migrate", "resolve", "--applied", "0_init");
}
prisma("migrate", "deploy");
