import type { Readable } from 'node:stream';

export interface StorageWriteResult {
  path: string;
  bytesWritten: number;
}

/**
 * Storage abstraction so the local filesystem driver used in MVP1 can be
 * swapped for an S3/R2 driver later without touching call sites.
 */
export interface StorageDriver {
  WriteFile(relativePath: string, data: Buffer): Promise<StorageWriteResult>;
  AppendFile(relativePath: string, data: Buffer): Promise<StorageWriteResult>;
  ReadFile(relativePath: string): Promise<Buffer>;
  ReadStream(relativePath: string): Readable;
  Move(fromRelativePath: string, toRelativePath: string): Promise<void>;
  Delete(relativePath: string): Promise<void>;
  DeleteDirectory(relativePath: string): Promise<void>;
  Exists(relativePath: string): Promise<boolean>;
  GetAbsolutePath(relativePath: string): string;
  EnsureDirectory(relativePath: string): Promise<void>;
  GetFileSize(relativePath: string): Promise<number>;
  /** Lists immediate subdirectory names of relativePath. Returns [] if the directory doesn't exist. */
  ListDirectories(relativePath: string): Promise<string[]>;
}

export const STORAGE_DRIVER = 'STORAGE_DRIVER';
