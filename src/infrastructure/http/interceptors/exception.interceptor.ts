import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ResponsableException } from 'infrastructure/http/exception/responsable.exception';

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  private logger = new Logger(ExceptionInterceptor.name);
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof ResponsableException) {
          return throwError(
            () =>
              new HttpException(
                {
                  message: error.message,
                },
                error.code,
              ),
          );
        }

        this.logger.error(error);
        return throwError(() => error);
      }),
    );
  }
}
