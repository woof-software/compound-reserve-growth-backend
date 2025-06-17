import { HttpException } from '@nestjs/common';

export abstract class ResponsableException extends HttpException {
  constructor(
    public readonly message: string,
    public readonly code: number,
  ) {
    super(message, code);
  }
}
