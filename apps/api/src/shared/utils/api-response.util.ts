import type { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data?: T;
  message: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class ApiResponse {
  static Success<T>(res: Response, data: T | null, message: string, statusCode = 200): void {
    const response: SuccessResponse<T> = {
      success: true,
      message,
      ...(data !== null && { data }),
    };
    res.status(statusCode).json(response);
  }

  static Error(res: Response, code: string, message: string, statusCode = 400): void {
    const response: ErrorResponse = {
      success: false,
      error: { code, message },
    };
    res.status(statusCode).json(response);
  }
}
