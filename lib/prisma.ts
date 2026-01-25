import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma for Supabase connection pooling in serverless (Vercel)
// 
// REQUIREMENTS for Supabase + Vercel:
// 1. DATABASE_URL must use Transaction Pooler (port 6543) with ?pgbouncer=true
// 2. DIRECT_URL must use Direct Connection (port 5432) for migrations
//
// The ?pgbouncer=true param tells Prisma to disable prepared statements
// which is required for PgBouncer transaction mode.
//
// See: https://www.prisma.io/docs/guides/database/supabase
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['error', 'warn'] 
    : ['error'],
})

// Prevent multiple instances in development (Next.js hot reload)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown - close connections on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

