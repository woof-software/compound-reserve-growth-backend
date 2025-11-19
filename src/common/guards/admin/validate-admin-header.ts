import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AdminHeaderDto } from './admin-header.dto';

export const validateAdminHeader = async (context: ExecutionContext): Promise<AdminHeaderDto> => {
  const request = context.switchToHttp().getRequest<Request>();

  const instance = plainToInstance(AdminHeaderDto, request.headers, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
  });

  if (!instance.token) {
    throw new BadRequestException('X-Admin-Token header is required');
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
