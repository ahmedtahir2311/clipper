# Auto-Clip Generator (MVP1)

Upload a long-form video, get back 7-10 short vertical (9:16) clips picked with classical
audio signal processing (ffmpeg `silencedetect`) - no AI/ML models involved. Preview and
download the clips manually; there's no auto-posting or scheduling in this phase.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, Atomic Design components |
| Backend | NestJS, feature-based modules |
| Worker | BullMQ, running as its own Node process |
| DB | PostgreSQL + Drizzle ORM |
| Storage | Local filesystem, behind a `StorageDriver` interface |
| Validation | Zod on every API boundary |
| Video processing | ffmpeg/ffprobe via `child_process`, no wrapper libraries |

## Monorepo layout

```
apps/
  web/     Next.js frontend
  api/     NestJS HTTP API (src/main.ts) + BullMQ worker (src/worker.main.ts)
packages/
  db/      Drizzle schema + Postgres client, shared by api and worker
  shared/  Zod schemas / DTOs shared by web and api
```

The HTTP API and the worker are two separate Node processes that both boot from
`apps/api` but from different entrypoints (`src/main.ts` vs `src/worker.main.ts`).
This is what guarantees uploads never block on ffmpeg: the HTTP process only ever
enqueues a BullMQ job and returns; all ffmpeg work happens in the worker process.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` or `npm i -g pnpm`)
- Docker (for Postgres + Redis), or your own local Postgres 16 / Redis 7
- `ffmpeg` and `ffprobe` on your `PATH` (the worker shells out to them directly)

## Setup

```bash
# 1. Install dependencies (also builds packages/db and packages/shared)
pnpm install

# 2. Start Postgres + Redis
pnpm docker:up

# 3. Copy and fill in environment variables
cp .env.example .env
# generate a bcrypt hash for your admin password:
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
# paste the result into ADMIN_PASSWORD_HASH in .env, and set a random SESSION_SECRET

# 4. Run database migrations
pnpm db:generate   # only needed after changing packages/db/src/schema
pnpm db:migrate

# 5. Start everything (web + api + worker)
pnpm dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001/api/v1

`pnpm dev` builds `packages/db`/`packages/shared` once, then runs `apps/web` (Next.js),
`apps/api` (Nest HTTP server, `--watch`), and the worker (`tsx watch`) in parallel, plus a
`tsc --watch` for each workspace package. If you change the Drizzle schema or a shared Zod
type while `pnpm dev` is running, the package rebuilds automatically; the API/worker
watchers don't currently hot-reload on `node_modules` changes, so restart `pnpm dev` after
a schema change to pick it up.

Environment variables are only loaded by `apps/api` (both entrypoints) - see
`.env.example` for the full list with defaults. Copy it to `apps/api/.env` as well if you
run `apps/api` outside the root `pnpm dev` orchestration (e.g. `pnpm --filter @clipper/api run dev`
from a shell that doesn't already have the root `.env` exported).

## How a video becomes clips

1. **Upload** - the frontend splits the file into 5MB chunks and PUTs them one at a
   time to `POST /uploads/:uploadId/chunks/:chunkIndex`. `POST /uploads/initiate` starts
   the session, `GET /uploads/:uploadId/status` reports how many chunks have landed (so an
   interrupted upload can resume from `nextExpectedChunkIndex`), and
   `POST /uploads/:uploadId/complete` finalizes the file, creates a `Job` row, and enqueues
   a `clip-generation` BullMQ job. The HTTP response comes back immediately - it never
   waits on ffmpeg.
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
5. **Progress** - after each clip, the `Job` row's `progress_current`/`progress_total`
   columns update, which the frontend picks up via polling `GET /jobs/:id`.

Every ffmpeg/ffprobe invocation runs with a hard timeout (`FFMPEG_TIMEOUT_MS`) and logs
its full command line + exit code, so a malformed source video can't hang the worker and
cut-quality issues can be traced back to the exact command that produced them.

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
  uploads/<uploadId>/          in-progress chunked uploads
  jobs/<jobId>/source.<ext>    the uploaded source video
  jobs/<jobId>/clips/          generated clip-N.mp4 + clip-N.jpg thumbnails
```

All file access goes through `StorageDriver` (`apps/api/src/shared/storage/storage.interface.ts`).
Swapping local disk for S3/R2 later means implementing that one interface and changing the
provider in `storage.module.ts` - no call sites elsewhere need to change.

## Cleanup

The worker registers a repeatable BullMQ job (`CLEANUP_CRON`, default daily at 03:00) that
deletes any `Job` (and its clips, cascade-deleted in Postgres) older than
`CLEANUP_RETENTION_DAYS` (default 7), including its files on disk. You can also delete a
job on demand via `DELETE /jobs/:id`.

## Auth

Single-user, session-cookie auth - there's no user table. Set `ADMIN_USERNAME` and
`ADMIN_PASSWORD_HASH` (a bcrypt hash, see Setup step 3) in `.env`. `POST /auth/login` sets
an httpOnly signed session cookie; every other API route requires it. The Next.js
middleware (`apps/web/middleware.ts`) redirects unauthenticated requests to `/login`
client-side, but the API's `AuthGuard` is what actually enforces it - it's the layer that
matters if you deploy this somewhere reachable from the internet.

## Testing

```bash
pnpm test
```

Runs the workspace's test scripts; the meaningful coverage today is
`apps/api/test/clip-selection.spec.ts`, which unit-tests the silence-boundary snapping and
clip-window-selection logic against known timestamps (fixed-interval fallback with no
silence, snapping onto silence boundaries, refusing a snap that would violate clip-length
bounds, and graceful degradation for short source videos) without touching ffmpeg or a
database.

## API summary

| Endpoint | Purpose |
|---|---|
| `POST /auth/login`, `POST /auth/logout` | Session auth |
| `POST /uploads/initiate` | Start a chunked upload, returns `uploadId` |
| `POST /uploads/:uploadId/chunks/:chunkIndex` | Upload one chunk (raw binary body) |
| `GET /uploads/:uploadId/status` | Resume support - next expected chunk index |
| `POST /uploads/:uploadId/complete` | Finalize upload, creates the `Job`, enqueues processing |
| `GET /jobs` | List jobs |
| `GET /jobs/:id` | Job status, progress, and clips once available |
| `GET /jobs/:id/download-all` | All clips for a job as a zip stream |
| `DELETE /jobs/:id` | Delete a job, its clips, and its files |
| `GET /clips/:id/download` | Stream a single clip |
| `GET /clips/:id/thumbnail` | Stream a clip's thumbnail |

All routes are prefixed with `/api/v1` and require the session cookie except `/auth/login`.

## Explicitly out of scope (MVP1)

Auto-posting/scheduling to any platform, manual crop-region selection, multi-user
roles, and cloud storage (the interface supports it, but only the local driver is
implemented).
