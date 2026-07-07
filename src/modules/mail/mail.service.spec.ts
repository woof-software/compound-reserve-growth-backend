import { MailService } from './mail.service';

describe('MailService', () => {
  const makeService = () => {
    const mailerService = { sendMail: jest.fn() };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'app.emailTo') {
          return 'dev@woof.software';
        }
        if (key === 'app.serviceName') {
          return 'reserves-test';
        }

        return undefined;
      }),
    };

    const service = new MailService(mailerService as never, configService as never);
    return { service, mailerService };
  };

  it('includes the service name in the subject and body of history error alerts', async () => {
    const { service, mailerService } = makeService();

    await service.notifyGetHistoryError('Skip 2026-06-27 block number 34201263');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@woof.software',
        subject: '[reserves-test] Got Compound Reserve Growth History Error',
        text: 'Service: reserves-test\nGot error while getting Compound Reserve Growth history! Skip 2026-06-27 block number 34201263',
      }),
    );
  });

  it('includes the service name in the subject and body of CAPO alerts', async () => {
    const { service, mailerService } = makeService();

    await service.notifyCapoAlert('Price feed deviation', 'CAPO price feed deviated on mainnet');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@woof.software',
        subject: '[reserves-test] CAPO Alert: Price feed deviation',
        text: 'Service: reserves-test\nCAPO price feed deviated on mainnet',
      }),
    );
  });
});
