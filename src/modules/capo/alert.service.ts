import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { MailService } from 'modules/mail/mail.service';

import { TelegramService } from './telegram.service';
import { Alert } from './entities/alert.entity';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly ALERT_COOLDOWN_MINUTES = 1; // Don't send same alert more than once per hour

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    private configService: ConfigService,
    private mailService: MailService,
    private telegramService: TelegramService,
  ) {}

  async createAlert(
    oracleAddress: string,
    chainId: number,
    type: string,
    severity: string,
    message: string,
    data?: any,
  ): Promise<void> {
    try {
      const recentAlert = await this.checkRecentAlert(oracleAddress, type);
      if (recentAlert) {
        this.logger.log(
          `Skipping alert - similar alert sent ${this.getMinutesAgo(recentAlert.timestamp)} minutes ago`,
        );
        return;
      }
      const alert = this.alertRepository.create({
        oracleAddress,
        chainId,
        type,
        severity,
        message,
        data,
        status: 'pending',
      });

      await this.alertRepository.save(alert);

      if (severity === 'critical' || severity === 'warning') {
        await this.sendNotifications(alert);
      }
    } catch (error) {
      this.logger.error('Failed to create alert:', error);
    }
  }

  private async checkRecentAlert(oracleAddress: string, type: string): Promise<Alert | null> {
    const cooldownTime = new Date();
    cooldownTime.setMinutes(cooldownTime.getMinutes() - this.ALERT_COOLDOWN_MINUTES);

    return this.alertRepository.findOne({
      where: {
        oracleAddress,
        type,
        status: 'sent',
        timestamp: MoreThan(cooldownTime),
      },
      order: { timestamp: 'DESC' },
    });
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    try {
      const formattedMessage = this.formatAlertMessage(alert);

      if (this.configService.get('ENABLE_EMAIL_ALERTS') === 'true') {
        await this.mailService.notifyCapoAlert(
          `Type: ${alert.type}, Severity: ${alert.severity}`,
          formattedMessage,
        );
      }

      if (this.configService.get('ENABLE_TELEGRAM_ALERTS') === 'true') {
        await this.telegramService.sendAlert(formattedMessage);
      }

      alert.status = 'sent';
      alert.sentAt = new Date();
      await this.alertRepository.save(alert);

      this.logger.log(`Alert sent successfully: ${alert.type} for ${alert.oracleAddress}`);
    } catch (error) {
      this.logger.error('Failed to send notifications:', error);

      alert.status = 'failed';
      alert.error = error.message;
      await this.alertRepository.save(alert);
    }
  }

  private formatAlertMessage(alert: Alert): string {
    let message = `${alert.severity.toUpperCase()} Alert\n\n`;
    message += `Type: ${alert.type}\n`;
    message += `Network: ${alert.chainId}\n`;
    message += `Oracle: ${alert.oracleAddress}\n`;
    message += `Message: ${alert.message}\n`;

    if (alert.data) {
      message += `\nDetails:\n`;
      for (const [key, value] of Object.entries(alert.data)) {
        message += `  ${key}: ${this.formatValue(value)}\n`;
      }
    }

    message += `\nTime: ${new Date().toISOString()}`;
    return message;
  }

  private formatValue(value: any): string {
    if (typeof value === 'number') {
      if (value > 1e6) {
        return `${(value / 1e6).toFixed(2)}M`;
      } else if (value > 1e3) {
        return `${(value / 1e3).toFixed(2)}K`;
      } else if (value < 1 && value > 0) {
        return value.toFixed(4);
      } else {
        return value.toFixed(2);
      }
    }
    return String(value);
  }

  private getMinutesAgo(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60));
  }

  async getRecentAlerts(limit = 100): Promise<Alert[]> {
    return this.alertRepository.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getAlertsByOracle(oracleAddress: string, limit = 50): Promise<Alert[]> {
    return this.alertRepository.find({
      where: { oracleAddress },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
