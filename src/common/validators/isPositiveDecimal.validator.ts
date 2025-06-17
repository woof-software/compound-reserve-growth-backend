import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPositiveDecimal', async: false })
export class IsPositiveDecimal implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a decimal number greater than 0`;
  }
}
