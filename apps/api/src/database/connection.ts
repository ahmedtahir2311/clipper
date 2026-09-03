import { CreateDatabaseClient, type Database } from '@clipper/db';

let cachedClient: Database | null = null;

export function GetDatabaseClient(): Database {
  if (!cachedClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    cachedClient = CreateDatabaseClient(connectionString);
  }
  return cachedClient;
}
