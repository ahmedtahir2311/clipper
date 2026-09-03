export interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponseBody<T> = ApiSuccessResponse<T> | ApiErrorResponse;
