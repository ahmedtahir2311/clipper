import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '../errors/app-error';
import { ApiResponse } from '../utils/api-response.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof ZodError) {
      const message = exception.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      ApiResponse.Error(res, ErrorCodes.VALIDATION_ERROR, message, 400);
      return;
    }

    if (exception instanceof AppError) {
      ApiResponse.Error(res, exception.code, exception.message, exception.statusCode);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message);
      ApiResponse.Error(res, HttpStatus[status] ?? 'HTTP_ERROR', message, status);
      return;
    }

    this.logger.error('Unhandled error', exception instanceof Error ? exception.stack : String(exception));
    ApiResponse.Error(res, ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred', 500);
  }
}
