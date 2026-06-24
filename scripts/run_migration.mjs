import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { Client } = require('pg')

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbHFtcG5zanpxenF3Z2JybHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTExMTcxNywiZXhwIjoyMDk0Njg3NzE3fQ.rsA0Tcf9G6lTbh1Mwxp9lX6TDTZGcVDFKlZcr2chvPw"
const PROJECT_REF = "ujlqmpnsjzqzqwgbrlxl"

// Tentar us-east-1 (onde o DNS aponta)
for (const host of [
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-us-east-2.pooler.supabase.com`,
  `db.${PROJECT_REF}.supabase.co`,
]) {
  const client = new Client({
    host,
    port: 5432,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  })
  try {
    await client.connect()
    console.log(`✅ Conectado via ${host}!`)
    const res = await client.query('SELECT current_user')
    console.log('User:', res.rows[0])
    await client.end()
    process.exit(0)
  } catch (err) {
    console.log(`❌ ${host}: ${err.message}`)
    try { await client.end() } catch {}
  }
}
