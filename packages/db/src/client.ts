import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

export function CreateDatabaseClient(connectionString: string): Database {
  const queryClient = postgres(connectionString, { max: 10 });
  return drizzle(queryClient, { schema });
}
