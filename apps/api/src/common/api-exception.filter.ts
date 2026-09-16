import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & { id?: string }>();
    const prismaCode = this.prismaCode(error);
    const status = error instanceof HttpException
      ? error.getStatus()
      : prismaCode === 'P2002'
        ? HttpStatus.CONFLICT
        : prismaCode === 'P2003'
          ? HttpStatus.BAD_REQUEST
        : prismaCode === 'P2025'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = error instanceof HttpException ? error.getResponse() : undefined;
    const message = typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'message' in raw
        ? Array.isArray(raw.message) ? raw.message.join('. ') : String(raw.message)
        : prismaCode === 'P2002'
          ? 'Ya existe un registro con esos datos.'
          : prismaCode === 'P2003'
            ? 'Hay una referencia inválida o el registro todavía está en uso.'
          : prismaCode === 'P2025'
            ? 'El registro solicitado no existe.'
            : 'Ocurrió un error interno.';

    response.status(status).json({
      code: this.codeFor(status),
      message: status >= 500 ? 'Ocurrió un error interno.' : message,
      requestId: request.id ?? 'unknown',
    });
  }

  private prismaCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  private codeFor(status: number): string {
    return ({
      400: 'VALIDATION_ERROR',
      401: 'AUTHENTICATION_REQUIRED',
      403: 'PERMISSION_DENIED',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
    } as Record<number, string>)[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  }
}
