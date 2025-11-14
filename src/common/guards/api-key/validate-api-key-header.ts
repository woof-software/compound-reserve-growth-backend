import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ApiKeyHeaderDto } from './api-key-header.dto';

export const validateApiKeyHeader = async (context: ExecutionContext): Promise<ApiKeyHeaderDto> => {
  const request = context.switchToHttp().getRequest<Request>();

  const instance = plainToInstance(ApiKeyHeaderDto, request.headers, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
  });

  if (!instance.key) {
    throw new BadRequestException('X-Api-Key header is required');
  }

  const errors = await validate(instance, {
    stopAtFirstError: true,
    validationError: {
      target: false,
      value: false,
    },
  });

  if (errors.length > 0) {
    const firstError = errors[0];
    const constraints = firstError?.constraints ?? {};
    const [message] = Object.values(constraints);

    throw new BadRequestException(message);
  }

  return instance;
};
