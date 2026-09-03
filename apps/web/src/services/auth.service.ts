import type { ApiResponseBody } from '@clipper/shared';
import { apiClient } from './api.client';

export interface LoginInput {
  username: string;
  password: string;
}

export class AuthService {
  static async Login(input: LoginInput): Promise<void> {
    const response = await apiClient.post<ApiResponseBody<{ username: string }>>('/auth/login', input);
    if (!response.data.success) {
      throw new Error(response.data.error.message);
    }
  }

  static async Logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  }
}
