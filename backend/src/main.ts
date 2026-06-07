import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Đứng sau Nginx reverse proxy -> tin X-Forwarded-* để lấy đúng IP client (Audit/Lockdown)
  app.set('trust proxy', true);

  // Bảo mật HTTP header + đọc HttpOnly cookie (refresh_token / access_token)
  app.use(helmet());
  app.use(cookieParser());

  // Prefix toàn cục cho API
  app.setGlobalPrefix('api/v1');

  // Validation nghiêm ngặt + strip các field không khai báo (chống mass-assignment / nâng quyền)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS cho SPA
  app.enableCors({
    origin: process.env.APP_BASE_URL ?? 'http://localhost',
    credentials: true,
  });

  // Swagger (chỉ bật ở môi trường không production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('VDT Zero-Trust DMS API')
      .setDescription('API quản lý tài liệu dự án theo mô hình Zero-Trust')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[VDT-DMS] API đang chạy tại http://localhost:${port}/api/v1`);
}

bootstrap();
