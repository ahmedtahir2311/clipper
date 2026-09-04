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

    // A streaming route (clip download, zip download) can fail after it has
    // already started writing the response - headers are sent, so there's no
    // way to send a JSON error body at that point. Just end the connection;
    // trying to write again would throw ERR_HTTP_HEADERS_SENT, and since
    // that throw happens inside the exception filter itself, Nest can't
    // catch it and the whole process would crash.
    if (res.headersSent) {
      this.logger.error(
        `Exception after headers were already sent for ${res.req?.method} ${res.req?.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
      res.destroy();
      return;
    }

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
