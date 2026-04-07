import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

const SYNC_RESERVES_CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)(?:-(\d+))?$/;

export function isSyncReservesCursor(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const match = SYNC_RESERVES_CURSOR_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [, updatedAt, id] = match;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== updatedAt) {
    return false;
  }

  return id === undefined || Number(id) > 0;
}

export function IsSyncReservesCursor(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isSyncReservesCursor',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message:
          '$property must be an ISO timestamp or an ISO timestamp followed by a positive row id',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return isSyncReservesCursor(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be an ISO timestamp or an ISO timestamp followed by a positive row id`;
        },
      },
    });
  };
}
