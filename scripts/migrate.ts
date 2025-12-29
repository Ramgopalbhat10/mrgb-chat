import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
  // Create account table (new table for better-auth)
  `CREATE TABLE IF NOT EXISTS account (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    access_token text,
    refresh_token text,
    access_token_expires_at integer,
    refresh_token_expires_at integer,
    scope text,
    id_token text,
    password text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  )`,

  // Create verification table (new table for better-auth)
  `CREATE TABLE IF NOT EXISTS verification (
    id text PRIMARY KEY NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at integer NOT NULL,
    created_at integer,
    updated_at integer
  )`,

  // Create user table if it doesn't exist (fresh start approach)
  `CREATE TABLE IF NOT EXISTS user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified integer DEFAULT 0 NOT NULL,
    image text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,

  // Create session table if it doesn't exist
  `CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    token text NOT NULL UNIQUE,
    expires_at integer NOT NULL,
    ip_address text,
    user_agent text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  )`,

  // Create shared_messages table for public sharing of individual responses
  `CREATE TABLE IF NOT EXISTS shared_messages (
    id text PRIMARY KEY NOT NULL,
    original_message_id text,
    conversation_id text,
    user_input text NOT NULL,
    response text NOT NULL,
    model_id text,
    created_at integer NOT NULL,
    expires_at integer
  )`,
  
  // Add new columns to existing shared_messages table if they don't exist
  `ALTER TABLE shared_messages ADD COLUMN original_message_id text`,
  `ALTER TABLE shared_messages ADD COLUMN conversation_id text`,
]

async function runMigrations() {
  console.log('Running migrations...')

  for (const sql of migrations) {
    try {
      console.log(`Executing: ${sql.substring(0, 50)}...`)
      await client.execute(sql)
      console.log('✓ Success')
    } catch (error: any) {
      // Ignore "already exists" or "duplicate column" errors
      if (
        error.message?.includes('already exists') ||
        error.message?.includes('duplicate column') ||
        error.message?.includes('no such column') ||
        error.message?.includes('no such table')
      ) {
        console.log(`⚠ Skipped (already applied or not needed): ${error.message}`)
      } else {
        console.error(`✗ Error: ${error.message}`)
      }
    }
  }

  console.log('Migrations complete!')
}

runMigrations().catch(console.error)
