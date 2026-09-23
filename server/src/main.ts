/**
 * Application entry point. Boots the Express HTTP server, hooks in request
 * logging and the optional WebDAV middleware, then starts the Nest app.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app/module';
import { config } from './config';
import { createWebdavMiddleware } from './webdav/provider';

/**
 * Creates the underlying Express app, attaches HTTP request logging and
 * (if configured) the WebDAV middleware, builds the Nest application on
 * top of it, enables CORS for the configured origins, and starts listening.
 */
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
