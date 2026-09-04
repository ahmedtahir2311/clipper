import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from '../src/shared/storage/local-storage.driver';
import { JobStoreService } from '../src/shared/store/job-store.service';

function FakeConfigService(root: string): ConfigService {
  return {
    get: (key: string, defaultValue: unknown) => (key === 'storage.root' ? root : defaultValue),
  } as unknown as ConfigService;
}

describe('JobStoreService', () => {
  let tempRoot: string;
  let store: JobStoreService;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'clipper-jobstore-'));
    const storage = new LocalStorageDriver(FakeConfigService(tempRoot));
    store = new JobStoreService(storage);
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a job with defaults and persists it to disk', async () => {
    const job = await store.CreateJob({ sourceFilename: 'video.mp4', sourcePath: '' });

    expect(job.status).toBe('pending');
    expect(job.clips).toEqual([]);
    expect(job.progressCurrent).toBe(0);

    const reloaded = await store.GetJob(job.id);
    expect(reloaded).toEqual(job);
  });

  it('returns null for a job that does not exist', async () => {
    expect(await store.GetJob('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('updates fields and bumps updatedAt', async () => {
    const job = await store.CreateJob({ sourceFilename: 'video.mp4', sourcePath: '' });
    await new Promise((resolve) => setTimeout(resolve, 2));

    const updated = await store.UpdateJob(job.id, { status: 'processing', progressTotal: 8 });

    expect(updated.status).toBe('processing');
    expect(updated.progressTotal).toBe(8);
    expect(updated.updatedAt).not.toBe(job.updatedAt);
  });

  it('adds clips to a job and indexes them for direct lookup', async () => {
    const job = await store.CreateJob({ sourceFilename: 'video.mp4', sourcePath: '' });

    const clip = await store.AddClip(job.id, {
      sequence: 1,
      filePath: `jobs/${job.id}/clips/clip-1.mp4`,
      thumbnailPath: null,
      startTime: 0,
      endTime: 30,
      durationSeconds: 30,
    });

    const reloaded = await store.GetJob(job.id);
    expect(reloaded?.clips).toHaveLength(1);
    expect(reloaded?.clips[0].id).toBe(clip.id);

    const found = await store.FindClip(clip.id);
    expect(found?.job.id).toBe(job.id);
    expect(found?.clip.id).toBe(clip.id);
  });

  it('lists jobs newest-first', async () => {
    const first = await store.CreateJob({ sourceFilename: 'a.mp4', sourcePath: '' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await store.CreateJob({ sourceFilename: 'b.mp4', sourcePath: '' });

    const list = await store.ListJobs();
    expect(list.map((j) => j.id)).toEqual([second.id, first.id]);
  });

  it('deletes a job and removes its clips from the index', async () => {
    const job = await store.CreateJob({ sourceFilename: 'video.mp4', sourcePath: '' });
    const clip = await store.AddClip(job.id, {
      sequence: 1,
      filePath: `jobs/${job.id}/clips/clip-1.mp4`,
      thumbnailPath: null,
      startTime: 0,
      endTime: 30,
      durationSeconds: 30,
    });

    await store.DeleteJob(job.id);

    expect(await store.GetJob(job.id)).toBeNull();
    expect(await store.FindClip(clip.id)).toBeNull();
    expect(await store.ListJobs()).toEqual([]);
  });

  it('FindClip returns null for an unknown clip id', async () => {
    expect(await store.FindClip('unknown-clip-id')).toBeNull();
  });

  it('RequireJob throws AppError for a missing job', async () => {
    await expect(store.RequireJob('missing')).rejects.toThrow('missing not found');
  });
});
