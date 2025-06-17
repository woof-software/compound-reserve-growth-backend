import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class Logger extends ConsoleLogger implements LoggerService {}
