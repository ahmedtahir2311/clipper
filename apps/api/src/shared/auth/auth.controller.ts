import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import type { Response } from 'express';
import { LoginSchema } from '@clipper/shared';
import { AppError, ErrorCodes } from '../errors/app-error';
import { ApiResponse } from '../utils/api-response.util';
import { CreateSessionToken, SESSION_COOKIE_NAME } from './session.util';

const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly configService: ConfigService) {}

  @Post('login')
  @HttpCode(200)
  async Login(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { username, password } = LoginSchema.parse(body);

    const expectedUsername = this.configService.get<string>('auth.adminUsername', 'admin');
    const passwordHash = this.configService.get<string>('auth.adminPasswordHash', '');
    const sessionSecret = this.configService.get<string>('auth.sessionSecret', '');

    const passwordMatches = passwordHash.length > 0 && (await compare(password, passwordHash));
    if (username !== expectedUsername || !passwordMatches) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid username or password', 401);
    }

    const token = CreateSessionToken(username, sessionSecret);
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });

    ApiResponse.Success(res, { username }, 'Logged in');
  }

  @Post('logout')
  @HttpCode(200)
  Logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME);
    ApiResponse.Success(res, null, 'Logged out');
  }
}
