import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get('TELEGRAM_BOT_TOKEN', '');
    this.chatId = this.configService.get('TELEGRAM_CHAT_ID', '');
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendAlert(message: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      this.logger.warn('Telegram credentials not configured');
      return;
    }

    try {
      const formattedMessage = `${message}`;

      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: formattedMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      this.logger.log('Telegram alert sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Telegram alert:', error.response?.data || error.message);
      throw error;
    }
  }
}
