import { drizzle } from 'drizzle-orm/libsql'
import { tursoClient } from './client'
import * as schema from './schema'

export const db = drizzle(tursoClient, { schema })

export type Database = typeof db
