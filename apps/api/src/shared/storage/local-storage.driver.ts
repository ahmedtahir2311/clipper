import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, open, readdir, readFile, rename, rm, stat, unlink } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { dirname, isAbsolute, join, normalize, resolve } from 'node:path';
import type { StorageDriver, StorageWriteResult } from './storage.interface';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(private readonly configService: ConfigService) {
    const configuredRoot = this.configService.get<string>('storage.root', './storage');
    this.root = isAbsolute(configuredRoot) ? configuredRoot : resolve(process.cwd(), configuredRoot);
  }

  GetAbsolutePath(relativePath: string): string {
    const normalized = normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
    return join(this.root, normalized);
  }

  async EnsureDirectory(relativePath: string): Promise<void> {
    await mkdir(this.GetAbsolutePath(relativePath), { recursive: true });
  }

  async WriteFile(relativePath: string, data: Buffer): Promise<StorageWriteResult> {
    const absolutePath = this.GetAbsolutePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    const handle = await open(absolutePath, 'w');
    try {
      await handle.writeFile(data);
    } finally {
      await handle.close();
    }
    return { path: relativePath, bytesWritten: data.byteLength };
  }

  async AppendFile(relativePath: string, data: Buffer): Promise<StorageWriteResult> {
    const absolutePath = this.GetAbsolutePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    const handle = await open(absolutePath, 'a');
    try {
      await handle.appendFile(data);
    } finally {
      await handle.close();
    }
    return { path: relativePath, bytesWritten: data.byteLength };
  }

  async ReadFile(relativePath: string): Promise<Buffer> {
    return readFile(this.GetAbsolutePath(relativePath));
  }

  ReadStream(relativePath: string): Readable {
    return createReadStream(this.GetAbsolutePath(relativePath));
  }

  async Move(fromRelativePath: string, toRelativePath: string): Promise<void> {
    const from = this.GetAbsolutePath(fromRelativePath);
    const to = this.GetAbsolutePath(toRelativePath);
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }

  async Delete(relativePath: string): Promise<void> {
    try {
      await unlink(this.GetAbsolutePath(relativePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async DeleteDirectory(relativePath: string): Promise<void> {
    await rm(this.GetAbsolutePath(relativePath), { recursive: true, force: true });
  }

  async Exists(relativePath: string): Promise<boolean> {
    try {
      await stat(this.GetAbsolutePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async GetFileSize(relativePath: string): Promise<number> {
    const stats = await stat(this.GetAbsolutePath(relativePath));
    return stats.size;
  }

  async ListDirectories(relativePath: string): Promise<string[]> {
    try {
      const entries = await readdir(this.GetAbsolutePath(relativePath), { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
