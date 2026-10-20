import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations need Neon's direct (unpooled) connection; the app itself uses the pooled DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
});
