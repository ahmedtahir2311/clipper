ALTER TYPE "public"."job_status" ADD VALUE 'downloading' BEFORE 'processing';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "source_url" varchar(2048);