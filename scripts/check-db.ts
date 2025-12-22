import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function checkDb() {
  console.log('Checking database...')
  console.log('URL:', process.env.TURSO_DATABASE_URL?.substring(0, 30) + '...')
  
  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    )
    console.log('Tables:', result.rows.map((r) => r.name))
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

checkDb()
