import type { ApiResponseBody, ClipDto, SetCaptionsDto } from '@clipper/shared';
import { apiClient } from './api.client';

export class ClipsService {
  static async SetCaptions(clipId: string, dto: SetCaptionsDto): Promise<ClipDto> {
    const response = await apiClient.post<ApiResponseBody<ClipDto>>(`/clips/${clipId}/captions`, dto);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.success ? 'Failed to start caption burn' : response.data.error.message);
    }
    return response.data.data;
  }

  static async ClearCaptions(clipId: string): Promise<ClipDto> {
    const response = await apiClient.delete<ApiResponseBody<ClipDto>>(`/clips/${clipId}/captions`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.success ? 'Failed to clear captions' : response.data.error.message);
    }
    return response.data.data;
  }
}
