import type { ApiResponseBody, JobDto } from '@clipper/shared';
import { apiClient } from './api.client';

export class JobsService {
  static async List(): Promise<JobDto[]> {
    const response = await apiClient.get<ApiResponseBody<JobDto[]>>('/jobs');
    if (!response.data.success) {
      throw new Error(response.data.error.message);
    }
    return response.data.data ?? [];
  }

  static async GetById(id: string): Promise<JobDto> {
    const response = await apiClient.get<ApiResponseBody<JobDto>>(`/jobs/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error.message);
    }
    if (!response.data.data) {
      throw new Error('Job not found');
    }
    return response.data.data;
  }

  static async Delete(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponseBody<null>>(`/jobs/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error.message);
    }
  }

  static GetDownloadAllUrl(id: string): string {
    return `${apiClient.defaults.baseURL}/jobs/${id}/download-all`;
  }
}
