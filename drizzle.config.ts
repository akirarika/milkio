import type { Config } from 'drizzle-kit';

const drizzleConfig = {
  schema: './generated/database-schema.ts',
  out: './drizzle',
  driver: 'mysql2', // 'pg' | 'mysql2' | 'better-sqlite' | 'libsql' | 'turso'
  dbCredentials: {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "root",
    database: "test"
  },
} satisfies Config

export default drizzleConfig;