import { ApiProperty } from "@nestjs/swagger";

export class DailyAggregationRequest {
    @ApiProperty({ description: 'Source ID', example: 1, nullable: true })
    sourceId: number | null;

    @ApiProperty({ description: 'Asset ID', example: 1, nullable: true })
    assetId: number | null;
}