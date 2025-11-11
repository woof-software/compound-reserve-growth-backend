import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get } from '@nestjs/common';

import { SourceService } from './source.service';
import { SourcesWithAssetsResponse } from './response/sourcesWithAssets.response';
import { ApiKeyEndpoint } from 'modules/api-key/decorators/api-key-endpoint';

@Injectable()
@Controller('sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @ApiKeyEndpoint()
  @ApiOperation({ summary: 'Get source list with assets' })
  @ApiResponse({ type: SourcesWithAssetsResponse })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getSourceList(): Promise<SourcesWithAssetsResponse> {
    return this.sourceService.listSourcesWithAssets();
  }
}
