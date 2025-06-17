import { HttpStatus } from '@nestjs/common';

import { ResponsableException } from 'infrastructure/http/exception/responsable.exception';

export default class InvalidArgumentException extends ResponsableException {
  constructor(message: string, code: number = HttpStatus.UNPROCESSABLE_ENTITY) {
    super(message, code);
  }
}
