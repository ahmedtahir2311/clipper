# Auto-Clip Generator (MVP1)

Upload a long-form video - or import one from a YouTube URL - and get back 7-10 short
vertical (9:16) clips picked with classical audio signal processing (ffmpeg
`silencedetect`) - no AI/ML models involved. Preview and download the clips manually;
there's no auto-posting or scheduling in this phase.

This is an **internal tool**: there's no login and no database. It's meant to run on a
private network / VPN / localhost, not to be exposed publicly - it has no access control
of any kind, and it processes unreleased video content.

> **YouTube import is for your own content.** Only paste a URL for a video you own or
> otherwise have the rights to clip - downloading someone else's video may violate
> YouTube's Terms of Service depending on how the clips are used.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, Atomic Design components |
| Backend | NestJS, feature-based modules |
| Worker | BullMQ, running as its own Node process |
| Job/clip metadata | JSON files on disk (no database - see below) |
| Storage | Local filesystem, behind a `StorageDriver` interface |
| Validation | Zod on every API boundary |
| Video processing | ffmpeg/ffprobe via `child_process`, no wrapper libraries |

## Monorepo layout

```
apps/
  web/     Next.js frontend
  api/     NestJS HTTP API (src/main.ts) + BullMQ worker (src/worker.main.ts)
packages/
  shared/  Zod schemas / DTOs shared by web and api
```

The HTTP API and the worker are two separate Node processes that both boot from
`apps/api` but from different entrypoints (`src/main.ts` vs `src/worker.main.ts`).
This is what guarantees uploads never block on ffmpeg: the HTTP process only ever
enqueues a BullMQ job and returns; all ffmpeg work happens in the worker process.

## No database

Job and clip metadata is stored as JSON files on disk instead of a database - see
`apps/api/src/shared/store/job-store.service.ts`. Each job gets
`storage/jobs/<jobId>/job.json` holding its status, progress, and embedded clip list;
`storage/clips-index.json` maps clip id -> job id so `GET /clips/:id/download` doesn't
have to scan every job. There's no locking between the HTTP process and the worker
process, which is safe here because only the HTTP process creates/deletes jobs and only
the worker (at BullMQ concurrency 1) updates a job while it owns it - the two never
write the same job concurrently. This trades multi-writer safety and query power for
zero ops overhead, which is the right trade for a single-user internal tool; it would
need revisiting before this became a shared multi-user service.

## No auth

There's no login, no session, no user table. Every API route is open to whoever can
reach the API process - access control is "don't expose this to the internet," not
anything the app enforces itself. If you ever need to put this behind something other
than a private network (a shared office server, a tunnel, etc.), put a reverse proxy
with its own auth in front of it rather than exposing the API directly.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` or `npm i -g pnpm`)
- Docker (for Redis), or your own local Redis 7
- `ffmpeg` and `ffprobe` on your `PATH` (the worker shells out to them directly)
- `yt-dlp` on your `PATH`, only if you want the YouTube URL import feature
  (`pip install yt-dlp`, or download the standalone binary from the
  [yt-dlp releases page](https://github.com/yt-dlp/yt-dlp/releases) - it also needs
  `ffmpeg` on `PATH` to merge separate video/audio streams, which you already have above)

## Setup

```bash
# 1. Install dependencies (also builds packages/shared)
pnpm install

# 2. Start Redis
pnpm docker:up

# 3. Copy and fill in environment variables (defaults are fine for local dev)
cp .env.example .env

# 4. Start everything (web + api + worker)
pnpm dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001/api/v1

`pnpm dev` builds `packages/shared` once, then runs `apps/web` (Next.js), `apps/api`'s
HTTP server and worker together (`apps/api`'s own `dev` script runs both via
`concurrently` - the HTTP server via `nest start --watch`, the worker via
`ts-node-dev --respawn`), and a `tsc --watch` for `packages/shared`, all in parallel.
`ts-node-dev` rather than a faster esbuild-based runner is required for the worker
specifically because NestJS's dependency injection relies on `emitDecoratorMetadata`,
which esbuild does not support - using an esbuild-based watcher there silently breaks
constructor injection. If you change a shared Zod type while `pnpm dev` is running, the
package rebuilds automatically; the API/worker watchers don't hot-reload on
`node_modules` changes, so restart `pnpm dev` after a shared-package change to pick it up.

Environment variables are only loaded by `apps/api` (both entrypoints) - see
`.env.example` for the full list with defaults. Copy it to `apps/api/.env` as well if you
run `apps/api` outside the root `pnpm dev` orchestration (e.g. `pnpm --filter @clipper/api run dev`
from a shell that doesn't already have the root `.env` exported).

## How a video becomes clips

1. **Upload** - the frontend splits the file into 5MB chunks and PUTs them one at a
   time to `POST /uploads/:uploadId/chunks/:chunkIndex`. `POST /uploads/initiate` starts
   the session, `GET /uploads/:uploadId/status` reports how many chunks have landed (so an
   interrupted upload can resume from `nextExpectedChunkIndex`), and
   `POST /uploads/:uploadId/complete` finalizes the file, creates the job's `job.json`, and
   enqueues a `clip-generation` BullMQ job. The HTTP response comes back immediately - it
   never waits on ffmpeg.
2. **Silence detection** - the worker runs `ffmpeg -af silencedetect=noise=<N>dB:d=<D>`
   over the source audio and parses `silence_start`/`silence_end` pairs out of stderr.
3. **Clip window selection** (pure function, see
   `apps/api/src/shared/ffmpeg/clip-selection.util.ts`) - picks a clip count that keeps
   average clip length inside the configured min/max, lays down evenly-spaced boundaries
   for that count, then snaps each interior boundary to the nearest detected silence edge
   within the configured snap window. A boundary that isn't close enough to any silence -
   including the case where no silence was detected at all - falls back to the
   fixed-interval cut point untouched. This is the piece most likely to need tuning, so
   it's fully unit-tested (`apps/api/test/clip-selection.spec.ts`) independent of ffmpeg.
4. **Cut + reframe** - each window is trimmed with `-c copy` first (no re-encode); if the
   resulting segment's duration drifts too far from what was requested (meaning ffmpeg
   snapped to the nearest keyframe instead of the exact cut point), it's redone with a
   re-encoding trim instead. The trimmed segment is then reframed to 9:16 (center-crop for
   landscape sources, scale+pad for sources that are already vertical/near-square) and a
   thumbnail is extracted.
5. **Progress** - after each clip, the job's `progressCurrent`/`progressTotal` fields
   update on disk, which the frontend picks up via polling `GET /jobs/:id`.

Every ffmpeg/ffprobe invocation runs with a hard timeout (`FFMPEG_TIMEOUT_MS`) and logs
its full command line + exit code, so a malformed source video can't hang the worker and
cut-quality issues can be traced back to the exact command that produced them.

### Importing from a YouTube URL instead

`POST /uploads/from-url` (only `youtube.com`/`youtu.be` hosts are accepted) is an
alternative entry point into the same pipeline:

1. The API synchronously fetches metadata (`yt-dlp --dump-single-json --skip-download`,
   bounded by `YT_DLP_METADATA_TIMEOUT_MS`) to get the title and duration, rejects live
   streams and anything longer than `YOUTUBE_IMPORT_MAX_DURATION_SECONDS`, creates the job
   (`status: pending`, `sourceUrl` set), and returns the `jobId` immediately.
2. A `source-download` BullMQ job (separate queue from clip generation) downloads the
   video in the worker (`status: downloading`, bounded by `YT_DLP_DOWNLOAD_TIMEOUT_MS`),
   capped at 1080p/mp4 to keep files a reasonable size.
3. Once downloaded, the job is handed to the same `clip-generation` queue the file-upload
   path uses - steps 2-5 above are identical from there on.

Job status is `pending -> downloading -> processing -> completed | failed` for a URL
import, vs. `pending -> processing -> completed | failed` for a direct file upload.

## Tuning silence detection

These are the knobs most likely to need iteration once you see real cut quality
(all in `.env`, read by the worker process):

| Var | Meaning |
|---|---|
| `SILENCE_NOISE_DB` | Noise floor passed to `silencedetect=noise=<N>dB`. More negative = more sensitive (detects quieter "silence"); e.g. `-30` is fairly sensitive, `-50` only catches near-total silence. |
| `SILENCE_MIN_DURATION_SECONDS` | Minimum gap length to count as silence (`d=` in the filter). Too low picks up brief pauses between words; too high misses real breaks. |
| `SILENCE_SNAP_WINDOW_SECONDS` | How far a fixed-interval cut point may move to reach a silence boundary. Larger = more clips end up on clean cuts, but individual clip lengths vary more from the target. |
| `CLIP_MIN_DURATION_SECONDS` / `CLIP_MAX_DURATION_SECONDS` | Bounds each clip must fall within. A snap that would violate these is rejected and the fixed-interval cut is used instead. |
| `CLIP_TARGET_COUNT_MIN` / `CLIP_TARGET_COUNT_MAX` | Desired clip count range (7-10 by default). Short source videos may still produce fewer than the minimum if they can't fit `CLIP_TARGET_COUNT_MIN` clips at `CLIP_MIN_DURATION_SECONDS` each. |

Re-running the pipeline after a config change only affects new jobs - re-upload the
source (or re-enqueue the job manually) to see the new thresholds take effect.

## Storage

Files live under `STORAGE_ROOT` (default `./storage`), organized as:

```
storage/
  clips-index.json             clip id -> job id lookup
  uploads/<uploadId>/          in-progress chunked uploads
  jobs/<jobId>/job.json        job status, progress, and embedded clip list
  jobs/<jobId>/source.<ext>    the uploaded/downloaded source video
  jobs/<jobId>/clips/          generated clip-N.mp4 + clip-N.jpg thumbnails
```

All file access goes through `StorageDriver` (`apps/api/src/shared/storage/storage.interface.ts`).
Swapping local disk for S3/R2 later means implementing that one interface and changing the
provider in `storage.module.ts` - no call sites elsewhere need to change. `JobStoreService`
(`apps/api/src/shared/store/job-store.service.ts`) is the only place that reads/writes
`job.json`/`clips-index.json` - if this ever needs to become a real database, that's the
one file to replace.

## Cleanup

The worker registers a repeatable BullMQ job (`CLEANUP_CRON`, default daily at 03:00) that
deletes any job (and its clips) older than `CLEANUP_RETENTION_DAYS` (default 7), including
its files on disk. You can also delete a job on demand via `DELETE /jobs/:id`.

## Testing

```bash
pnpm test
```

- `apps/api/test/clip-selection.spec.ts` unit-tests the silence-boundary snapping and
  clip-window-selection logic against known timestamps (fixed-interval fallback with no
  silence, snapping onto silence boundaries, refusing a snap that would violate
  clip-length bounds, and graceful degradation for short source videos) without touching
  ffmpeg.
- `apps/api/test/job-store.spec.ts` exercises the JSON-file job/clip store against a real
  temp directory on disk (create, update, add clips, list ordering, delete cascading to
  the clips index, not-found handling) without mocking the filesystem.

## API summary

| Endpoint | Purpose |
|---|---|
| `POST /uploads/initiate` | Start a chunked upload, returns `uploadId` |
| `POST /uploads/:uploadId/chunks/:chunkIndex` | Upload one chunk (raw binary body) |
| `GET /uploads/:uploadId/status` | Resume support - next expected chunk index |
| `POST /uploads/:uploadId/complete` | Finalize upload, creates the job, enqueues processing |
| `POST /uploads/from-url` | Import from a YouTube URL, creates the job, enqueues download |
| `GET /jobs` | List jobs |
| `GET /jobs/:id` | Job status, progress, and clips once available |
| `GET /jobs/:id/download-all` | All clips for a job as a zip stream |
| `DELETE /jobs/:id` | Delete a job, its clips, and its files |
| `GET /clips/:id/download` | Stream a single clip |
| `GET /clips/:id/thumbnail` | Stream a clip's thumbnail |

All routes are prefixed with `/api/v1`. None of them require authentication - see
[No auth](#no-auth) above.

## Explicitly out of scope (MVP1)

Auto-posting/scheduling to any platform, manual crop-region selection, multi-user
roles/auth, cloud storage (the interface supports it, but only the local driver is
implemented), and importing from anything other than YouTube (no generic yt-dlp
site-support surface is exposed - only `youtube.com`/`youtu.be` URLs are accepted).
