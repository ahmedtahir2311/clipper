import { relations } from 'drizzle-orm';
import { jobs } from './jobs.schema';
import { clips } from './clips.schema';

export const jobsRelations = relations(jobs, ({ many }) => ({
  clips: many(clips),
}));

export const clipsRelations = relations(clips, ({ one }) => ({
  job: one(jobs, {
    fields: [clips.jobId],
    references: [jobs.id],
  }),
}));
