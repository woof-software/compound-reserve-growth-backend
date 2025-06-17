import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PaginatedDataResponse } from 'common/response/paginated-data.response';

export const ApiPaginatedResponse = <Dto extends Type<unknown>>(type: Dto) =>
  applyDecorators(
    ApiExtraModels(PaginatedDataResponse, type),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDataResponse) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(type) },
              },
            },
          },
        ],
      },
    }),
  );
