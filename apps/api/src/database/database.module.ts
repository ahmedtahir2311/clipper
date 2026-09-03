import { Global, Module } from '@nestjs/common';
import { GetDatabaseClient } from './connection';

export const DATABASE_CLIENT = 'DATABASE_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => GetDatabaseClient(),
    },
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule {}
