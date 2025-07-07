import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly email: string;
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.email = this.configService.get<string>('app.emailTo') || '';
  }

  async notifyGetHistoryError(message: string) {
    return this.mailerService.sendMail({
      from: process.env.EMAIL_FROM,
      to: this.email,
      subject: 'Got Compound Reserve Growth History Error',
      text: `Got error while getting Compound Reserve Growth history! ${message}`,
    });
  }
}
