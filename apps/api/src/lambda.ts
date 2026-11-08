import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

let cachedHandler: ReturnType<typeof serverlessExpress>;

async function bootstrap() {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn'],
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });

  await app.init();

  return serverlessExpress({ app: expressApp });
}

export const handler = async (
  event: Record<string, unknown>,
  context: Record<string, unknown>,
  callback: unknown,
) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }

  // Netlify Functions omit requestContext, which serverless-express
  // needs to identify the event as API Gateway v1 format.
  if (!event.requestContext) {
    event.requestContext = { resourceId: 'netlify', httpMethod: event.httpMethod, path: event.path };
  }

  return cachedHandler(event as never, context as never, callback as never);
};
