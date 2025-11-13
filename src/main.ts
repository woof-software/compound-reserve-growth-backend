import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { TAppConfig } from './config/app';
import { Logger } from './infrastructure/logger';

async function bootstrap() {
  const logLevel = (process.env.LOG_LEVEL?.split(',') || ['error']) as LogLevel[];
  const logger = new Logger();
  logger.setLogLevels(logLevel);

  const app = await NestFactory.create(AppModule, { logger });
  const configService = app.get(ConfigService);
  const appConfig = configService.get<TAppConfig>('app');

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  if (appConfig.apiDocumentation) {
    const config = new DocumentBuilder()
      .setTitle('Compound Reserve Growth API project ')
      .setDescription('Compound Reserve Growth API project REST API documentation')
      .setVersion('1.0.1')
      .addTag('Compound Reserve Growth API project documentation')
      .addSecurity('AdminToken', {
        type: 'apiKey',
        in: 'header',
        name: 'X-Admin-Token',
        description: 'Administrative access token',
      })
      .addSecurity('ApiKeyAuth', {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
        description: 'API access key',
      })
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Middleware to prevent caching
    app.use('/api/docs', (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      next();
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        cache: false,
      },
    });
  }

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.enableCors(appConfig.cors);

  await app.listen(appConfig.port, appConfig.host);

  logger.log(
    `Application is running on http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
  );
}

bootstrap();
