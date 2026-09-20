import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/module';
import { config } from './config';
import { createWebdavMiddleware } from './webdav/provider';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
  });

  const webdavMiddleware = createWebdavMiddleware();
  if (webdavMiddleware) {
    app.use(webdavMiddleware);
  }

  await app.listen(config.server.port);
}
bootstrap();
