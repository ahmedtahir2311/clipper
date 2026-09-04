import { pgTable, uuid, varchar, integer, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';

export const jobStatusEnum = pgEnum('job_status', ['pending', 'downloading', 'processing', 'completed', 'failed']);

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: jobStatusEnum('status').notNull().default('pending'),
  sourceFilename: varchar('source_filename', { length: 512 }).notNull(),
  sourcePath: varchar('source_path', { length: 1024 }).notNull(),
  /** Set when the source came from POST /uploads/from-url instead of a direct file upload. */
  sourceUrl: varchar('source_url', { length: 2048 }),
  durationSeconds: integer('duration_seconds'),
  progressCurrent: integer('progress_current').notNull().default(0),
  progressTotal: integer('progress_total').notNull().default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
