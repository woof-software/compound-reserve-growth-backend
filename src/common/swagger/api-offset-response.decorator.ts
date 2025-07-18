import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { OffsetDataResponse } from 'common/response/offset-data.response';

export const ApiOffsetResponse = <Dto extends Type<unknown>>(type: Dto) =>
  applyDecorators(
    ApiExtraModels(OffsetDataResponse, type),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(OffsetDataResponse) },
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
