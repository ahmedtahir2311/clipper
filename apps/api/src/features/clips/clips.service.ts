import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { clips, type Database, type Clip } from '@clipper/db';
import { DATABASE_CLIENT } from '../../database/database.module';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';

@Injectable()
export class ClipsService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: Database) {}

  async GetClip(clipId: string): Promise<Clip> {
    const [row] = await this.db.select().from(clips).where(eq(clips.id, clipId));
    if (!row) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} not found`, 404);
    }
    return row;
  }
}
