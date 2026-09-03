import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppError, ErrorCodes } from '../errors/app-error';
import { SESSION_COOKIE_NAME, VerifySessionToken } from './session.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
    const secret = this.configService.get<string>('auth.sessionSecret', '');

    const session = VerifySessionToken(token, secret);
    if (!session) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
    }

    return true;
  }
}
