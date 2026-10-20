import "server-only";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "./generated/prisma/client";

// Neon's driver talks over WebSockets, which keeps interactive transactions working on Vercel.
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = makeClient();
  return globalForPrisma.prisma;
}

// Created on first use, so `next build` doesn't need database credentials.
export const prisma = new Proxy({} as PrismaClient, {
  get: (_, prop) => {
    const c = client();
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? v.bind(c) : v;
  },
});

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
