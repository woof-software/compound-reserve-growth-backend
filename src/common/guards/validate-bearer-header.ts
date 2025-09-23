import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BearerHeaderDto } from './bearer-header.dto';

export const validateBearerHeader = async (context: ExecutionContext): Promise<BearerHeaderDto> => {
  const req = context.switchToHttp().getRequest<Request>();

  const instance = plainToInstance(BearerHeaderDto, req.headers, {
    enableImplicitConversion: true, // For transforms like ToLowerCase
    excludeExtraneousValues: true, // @Exclude/@Expose
  });
  const errors = await validate(instance, {
    validationError: {
      target: false,
      value: false,
    },
  }); // Making sure we will not show secrets

  if (errors.length > 0) {
    const [first] = errors;
    const [message] = Object.values(first?.constraints ?? {});
    throw new BadRequestException(message);
  }

  return instance;
};
