import { pgTable, uuid, varchar, integer, timestamp, doublePrecision } from 'drizzle-orm/pg-core';
import { jobs } from './jobs.schema';

export const clips = pgTable('clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  filePath: varchar('file_path', { length: 1024 }).notNull(),
  thumbnailPath: varchar('thumbnail_path', { length: 1024 }),
  startTime: doublePrecision('start_time').notNull(),
  endTime: doublePrecision('end_time').notNull(),
  durationSeconds: doublePrecision('duration_seconds').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;
