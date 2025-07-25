import {
  Injectable,
  BadGatewayException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

import { RunwayResponse } from './response/runway.response';

import { Logger } from 'infrastructure/logger';

@Injectable()
export class RunwayService {
  private readonly logger = new Logger(RunwayService.name);
  private sheets: any;

  constructor(private readonly configService: ConfigService) {
    this.sheets = google.sheets({
      version: 'v4',
      auth: this.configService.get<string>('google.apiKey'),
    });
  }

  async getData(): Promise<RunwayResponse[]> {
    try {
      const spreadsheetId = this.configService.get<string>('google.spreadsheetId');
      const range = this.configService.get<string>('google.range');

      if (!spreadsheetId) {
        throw new InternalServerErrorException('GOOGLE_SHEET_ID not configured');
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];

      if (rows.length === 0) {
        return [];
      }

      const parsedData: RunwayResponse[] = rows.map((row: string[]) => ({
        type: row[0] || '',
        name: row[1] || '',
        iconKey: row[2] || '',
        discipline: row[3] || '',
        token: row[4] || '',
        amount: this.parseNumber(row[5]),
        value: this.parseNumber(row[6]),
        paymentType: row[7] || '',
        startDate: row[8] || '',
        endDate: row[9] || '',
        proposalLink: row[10] || '',
      }));

      return parsedData;
    } catch (error) {
      this.logger.error('Error fetching Google Sheets data:', error);

      if (error.response?.status === 403) {
        throw new ForbiddenException(
          'Access denied to Google Sheets. Check API key and sheet permissions.',
        );
      }

      if (error.response?.status === 404) {
        throw new NotFoundException('Spreadsheet not found. Check GOOGLE_SHEET_ID.');
      }

      throw new BadGatewayException(`Failed to fetch sheet data: ${error.message}`);
    }
  }

  private parseNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[,\s]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
}
