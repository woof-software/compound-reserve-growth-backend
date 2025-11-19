import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  SerializeOptions,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AdminService } from 'modules/admin/admin.service';
import { StartCollectionResponse } from 'modules/admin/response';
import { ApiKeyService } from 'modules/api-key/api-key.service';
import { CreateApiKeyDto } from 'modules/api-key/dto/create-api-key.dto';
import { UpdateApiKeyDto } from 'modules/api-key/dto/update-api-key.dto';
import { SearchApiKeyDto } from 'modules/api-key/dto/search-api-key.dto';
import { ApiKeyResponse } from 'modules/api-key/response/api-key.response';

import { AdminEndpoint } from '@/common/decorators';

@ApiTags('Admin')
@Controller('v1/admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Get('/access')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Test admin access',
    description: 'Returns OK if has admin access.',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  testAccess(): string {
    return 'OK';
  }

  @Post('/reserves/collect')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Start reserves processing',
    description:
      'Returns the process status response.\n' +
      '  - If the `clearData` field is set to true in the request, existing data in the database will be cleared before the new collection starts.\n' +
      '  - The `data` field specifies the time (in ISO format) at which data collection should start.\n' +
      '  - When `clearData` is enabled and `data` is not specified, the start of the report is considered to be the create of the contract',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startReserves(@Query() request: StartCollectionResponse): Promise<string> {
    return this.admin.startReserves(request);
  }

  @Post('/stats/collect')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Start stats processing',
    description:
      'Returns the process status response.\n' +
      '  - If the `clearData` field is set to true in the request, existing data in the database will be cleared before the new collection starts.\n' +
      '  - The `data` field specifies the time (in ISO format) at which data collection should start.\n' +
      '  - When `clearData` is enabled and `data` is not specified, the start of the report is considered to be the create of the contract',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async startStats(@Query() request: StartCollectionResponse): Promise<string> {
    return this.admin.startStats(request);
  }

  @Post('/api-keys')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Create API key',
    description: 'Creates a new API key with client name, IP whitelist, and domain whitelist.',
  })
  @ApiResponse({ status: 201, type: ApiKeyResponse })
  @SerializeOptions({ type: ApiKeyResponse })
  async createApiKey(@Body() createDto: CreateApiKeyDto): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyService.create(createDto);
    return new ApiKeyResponse(apiKey);
  }

  @Patch('/api-keys/:id')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Update API key',
    description: 'Updates an existing API key. Triggers cache reset for the updated key.',
  })
  @ApiResponse({ status: 200, type: ApiKeyResponse })
  @SerializeOptions({ type: ApiKeyResponse })
  async updateApiKey(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyService.update(id, updateDto);
    return new ApiKeyResponse(apiKey);
  }

  @Post('/api-keys/:id/pause')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Pause API key',
    description: 'Sets the API key status to paused.',
  })
  @ApiResponse({ status: 200, type: ApiKeyResponse })
  @SerializeOptions({ type: ApiKeyResponse })
  async pauseApiKey(@Param('id', ParseIntPipe) id: number): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyService.pause(id);
    return new ApiKeyResponse(apiKey);
  }

  @Post('/api-keys/:id/activate')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Activate API key',
    description: 'Sets the API key status to active.',
  })
  @ApiResponse({ status: 200, type: ApiKeyResponse })
  @SerializeOptions({ type: ApiKeyResponse })
  async activateApiKey(@Param('id', ParseIntPipe) id: number): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyService.activate(id);
    return new ApiKeyResponse(apiKey);
  }

  @Delete('/api-keys/:id')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Delete API key',
    description: 'Sets the API key status to deleted (soft delete).',
  })
  @ApiResponse({ status: 200, type: ApiKeyResponse })
  @SerializeOptions({ type: ApiKeyResponse })
  async deleteApiKey(@Param('id', ParseIntPipe) id: number): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyService.delete(id);
    return new ApiKeyResponse(apiKey);
  }

  @Get('/api-keys')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Search API keys',
    description: 'Search API keys by client name, domain, or status.',
  })
  @ApiResponse({ status: 200, type: [ApiKeyResponse] })
  @SerializeOptions({ type: ApiKeyResponse })
  async searchApiKeys(@Query() searchDto: SearchApiKeyDto): Promise<ApiKeyResponse[]> {
    const apiKeys = await this.apiKeyService.search(searchDto);
    return apiKeys.map((key) => new ApiKeyResponse(key));
  }

  @Get('/api-keys/:id')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Get API key by ID',
    description: 'Retrieves a specific API key by its ID.',
  })
  @ApiResponse({ status: 200, type: ApiKeyResponse })
  @SerializeOptions({ type: ApiKeyResponse })
  async getApiKey(@Param('id', ParseIntPipe) id: number): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyService.findOne(id);
    return new ApiKeyResponse(apiKey);
  }

  @Post('/api-keys/cache/reset')
  @AdminEndpoint()
  @ApiOperation({
    summary: 'Reset API key cache',
    description: 'Resets cache for a specific API key (if key provided) or all API keys.',
  })
  @ApiResponse({ status: 200, type: String })
  @SerializeOptions({ type: String })
  async resetCache(@Query('key') key?: string): Promise<string> {
    await this.apiKeyService.resetCache(key);
    return key ? `Cache reset for key: ${key}` : 'Cache reset for all keys';
  }
}
