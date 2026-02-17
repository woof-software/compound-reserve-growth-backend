import { SourcesUpdateCommand } from '@/modules/sources-update/cli/sources-update.command';

describe('SourcesUpdateCommand', () => {
  it('runs sources update service', async () => {
    const service = { run: jest.fn().mockResolvedValue(undefined) };
    const command = new SourcesUpdateCommand(service as never);

    await command.run();

    expect(service.run).toHaveBeenCalledTimes(1);
  });

  it('rethrows service errors', async () => {
    const service = { run: jest.fn().mockRejectedValue(new Error('boom')) };
    const command = new SourcesUpdateCommand(service as never);

    await expect(command.run()).rejects.toThrow('boom');
  });
});
