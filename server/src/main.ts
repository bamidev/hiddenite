import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app/module';
import { config } from './config';
import { createWebdavMiddleware } from './webdav/provider';

async function bootstrap() {
  const httpLogger = new Logger('HTTP');
  const server = express();
  server.use((req, res, next) => {
    res.on('finish', () => {
      httpLogger.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
    });
    next();
  });

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  const webdavMiddleware = createWebdavMiddleware();
  if (webdavMiddleware) {
    app.use(webdavMiddleware);
  }

  app.enableCors({
    origin: [`http://localhost:${config.server.port}`, ...config.server.baseUrls],
  });

  await app.listen(config.server.port);
}
bootstrap();
