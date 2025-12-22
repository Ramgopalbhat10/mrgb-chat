import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const tablesToDrop = [
  'users',    // Old auth table, replaced by 'user'
  'sessions', // Old auth table, replaced by 'session'
]

async function cleanup() {
  console.log('Cleaning up old unused tables...\n')

  // First, show current tables
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  console.log('Current tables:', result.rows.map((r) => r.name))
  console.log('')

  for (const table of tablesToDrop) {
    try {
      console.log(`Dropping table: ${table}`)
      await client.execute(`DROP TABLE IF EXISTS ${table}`)
      console.log(`✓ Dropped ${table}`)
    } catch (error: any) {
      console.error(`✗ Error dropping ${table}: ${error.message}`)
    }
  }

  console.log('')

  // Show remaining tables
  const afterResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  console.log('Remaining tables:', afterResult.rows.map((r) => r.name))
  console.log('\nCleanup complete!')
}

cleanup().catch(console.error)
