import type { ApiResponseBody } from '@clipper/shared';
import { UPLOAD_CHUNK_SIZE_BYTES } from '@/config/constants';
import { apiClient } from './api.client';

interface InitiateUploadResponse {
  uploadId: string;
}

interface CompleteUploadResponse {
  jobId: string;
}

interface ImportFromUrlResponse {
  jobId: string;
}

export interface UploadProgress {
  chunkIndex: number;
  totalChunks: number;
}

export class UploadsService {
  static async UploadFile(file: File, onProgress?: (progress: UploadProgress) => void): Promise<string> {
    const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE_BYTES);

    const initiateResponse = await apiClient.post<ApiResponseBody<InitiateUploadResponse>>('/uploads/initiate', {
      filename: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type,
      totalChunks,
    });
    if (!initiateResponse.data.success || !initiateResponse.data.data) {
      throw new Error(initiateResponse.data.success ? 'Failed to initiate upload' : initiateResponse.data.error.message);
    }
    const { uploadId } = initiateResponse.data.data;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * UPLOAD_CHUNK_SIZE_BYTES;
      const end = Math.min(start + UPLOAD_CHUNK_SIZE_BYTES, file.size);
      const chunk = file.slice(start, end);

      await apiClient.post(`/uploads/${uploadId}/chunks/${chunkIndex}`, chunk, {
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      onProgress?.({ chunkIndex: chunkIndex + 1, totalChunks });
    }

    const completeResponse = await apiClient.post<ApiResponseBody<CompleteUploadResponse>>(`/uploads/${uploadId}/complete`);
    if (!completeResponse.data.success || !completeResponse.data.data) {
      throw new Error(completeResponse.data.success ? 'Failed to complete upload' : completeResponse.data.error.message);
    }

    return completeResponse.data.data.jobId;
  }

  static async ImportFromUrl(url: string): Promise<string> {
    const response = await apiClient.post<ApiResponseBody<ImportFromUrlResponse>>('/uploads/from-url', { url });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.success ? 'Failed to start import' : response.data.error.message);
    }
    return response.data.data.jobId;
  }
}
