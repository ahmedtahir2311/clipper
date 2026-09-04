import { Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { AppError, ErrorCodes } from '../errors/app-error';

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs a child process with a hard timeout, collecting stdout/stderr and
 * logging the invocation + exit code. Shared by FfmpegService and
 * YtDlpService so a malformed/hanging input (video or URL) can never hang
 * a worker indefinitely, and every invocation is traceable the same way.
 */
export function RunProcess(command: string, args: string[], timeoutMs: number, logger: Logger): Promise<ProcessResult> {
  const invocation = `${command} ${args.join(' ')}`;

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      logger.error(`Timed out after ${timeoutMs}ms, killing process: ${invocation}`);
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      logger.error(`Failed to spawn: ${invocation} - ${error.message}`);
      reject(new AppError(ErrorCodes.EXTERNAL_PROCESS_FAILED, `Failed to start ${command}: ${error.message}`, 500));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const exitCode = code ?? -1;
      logger.log(`[exit ${exitCode}] ${invocation}`);

      if (timedOut) {
        reject(new AppError(ErrorCodes.EXTERNAL_PROCESS_FAILED, `${command} timed out after ${timeoutMs}ms`, 500));
        return;
      }

      if (exitCode !== 0) {
        logger.error(`stderr for failed invocation: ${stderr.slice(-2000)}`);
        reject(
          new AppError(
            ErrorCodes.EXTERNAL_PROCESS_FAILED,
            `${command} exited with code ${exitCode}: ${stderr.slice(-500) || 'no stderr output'}`,
            500
          )
        );
        return;
      }

      resolvePromise({ stdout, stderr, exitCode });
    });
  });
}
