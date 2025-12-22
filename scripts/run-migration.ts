import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function runMigration() {
  console.log('Running migration: Add archived column to conversations...')

  try {
    // Check if column already exists
    const tableInfo = await client.execute(
      "PRAGMA table_info('conversations')",
    )
    const hasArchived = tableInfo.rows.some((row) => row.name === 'archived')

    if (hasArchived) {
      console.log('✓ Column "archived" already exists, skipping.')
      return
    }

    // Add the archived column with default value
    await client.execute(
      'ALTER TABLE conversations ADD COLUMN archived INTEGER DEFAULT 0 NOT NULL',
    )
    console.log('✓ Added "archived" column to conversations table')

    // Verify
    const verify = await client.execute("PRAGMA table_info('conversations')")
    console.log(
      'Columns:',
      verify.rows.map((r) => r.name),
    )
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
