import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly email: string;
  private readonly serviceName: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.email = this.configService.get<string>('app.emailTo') || '';
    this.serviceName = this.configService.get<string>('app.serviceName') || 'unknown';
  }

  async notifyGetHistoryError(message: string) {
    return this.mailerService.sendMail({
      from: process.env.EMAIL_FROM,
      to: this.email,
      subject: `[${this.serviceName}] Got Compound Reserve Growth History Error`,
      text: `Service: ${this.serviceName}\nGot error while getting Compound Reserve Growth history! ${message}`,
    });
  }

  async notifyCapoAlert(subject: string, message: string) {
    return this.mailerService.sendMail({
      from: process.env.EMAIL_FROM,
      to: this.email,
      subject: `[${this.serviceName}] CAPO Alert: ${subject}`,
      text: `Service: ${this.serviceName}\n${message}`,
    });
  }
}
