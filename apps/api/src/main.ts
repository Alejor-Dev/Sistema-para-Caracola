import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const production = process.env.NODE_ENV === 'production';
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  if (production && !process.env.WEB_ORIGIN) {
    throw new Error('WEB_ORIGIN es obligatorio en producción.');
  }

  app.setGlobalPrefix('api/v1');
  app.use(helmet({ contentSecurityPolicy: production }));
  app.use(cookieParser());
  app.use((request: { id?: string; headers: Record<string, unknown> }, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    const supplied = request.headers['x-request-id'];
    request.id = typeof supplied === 'string' && supplied.length <= 100 ? supplied : randomUUID();
    response.setHeader('x-request-id', request.id);
    next();
  });
  app.enableCors({ origin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(Number(process.env.PORT ?? 4000), '127.0.0.1');
}

void bootstrap();
