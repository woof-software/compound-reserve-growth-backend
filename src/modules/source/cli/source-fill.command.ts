import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import axios from 'axios';

import { ContractService } from 'modules/contract/contract.service';
import { GithubService } from 'modules/github/github.service';
import { SourceService } from 'modules/source/source.service';
import { Source } from '../source.entity';
import { Algorithm } from '@app/common/enum/algorithm.enum';
import { sources } from '../constants/sources';

@Command({ name: 'source:fill', description: 'Fill source table' })
export class SourceFillCommand extends CommandRunner {
  private readonly logger = new Logger(SourceFillCommand.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
  ) {
    super();
  }

  async run() {
    try {
      this.logger.log('Starting to fill source table...');

      const dbSources = await this.sourceService.listAll();

      const rootsPaths = await this.githubService.listAllRootsJson();
      this.logger.log(`Found ${rootsPaths.length} roots.json files in the repository`);

      for (const path of rootsPaths) {
        const rawUrl = `https://raw.githubusercontent.com/compound-finance/comet/main/deployments/${path}`;

        try {
          const response = await axios.get(rawUrl, { responseType: 'json' });
          const rootObj = response.data;
          const marketData = await this.contractService.readMarketData(rootObj, path);
          const existingSource = dbSources.find(
            (source) =>
              source.address === marketData.cometAddress &&
              source.network === marketData.network &&
              source.algorithm === Algorithm.COMET,
          );
          if (existingSource) continue;
          const creationBlockNumber = await this.contractService.getContractCreationBlock(
            marketData.cometAddress,
            marketData.network,
          );
          const newMarketSource = new Source(
            marketData.cometAddress,
            marketData.network,
            Algorithm.COMET,
            creationBlockNumber,
            marketData.market,
          );

          await this.sourceService.create(newMarketSource);
          this.logger.log(`Added new source: ${marketData.network}/${marketData.market}`);
        } catch (err) {
          this.logger.error(
            `Error creating comet market source:`,
            err instanceof Error ? err.message : String(err),
          );
          continue;
        }
      }

      for (const source of sources) {
        if (source.algorithm === Algorithm.COMPTROLLER) {
          const comptrollerMarkets = await this.contractService.getAllComptrollerMarkets(
            source.address,
            source.network,
          );
          for (const marketAddress of comptrollerMarkets) {
            const existingSource = dbSources.find(
              (s) =>
                s.address === marketAddress &&
                s.network === source.network &&
                s.algorithm === Algorithm.MARKET_V2,
            );
            if (existingSource) continue;

            const creationBlockNumber = await this.contractService.getContractCreationBlock(
              marketAddress,
              source.network,
            );
            const symbol = await this.contractService.getMarketSymbol(
              marketAddress,
              source.network,
            );
            const newMarketSource = new Source(
              marketAddress,
              source.network,
              Algorithm.MARKET_V2,
              creationBlockNumber,
              symbol,
            );

            await this.sourceService.create(newMarketSource);
            this.logger.log(`Added new source: ${source.network}/${Algorithm.MARKET_V2}`);
          }
        }
        const existingSource = dbSources.find(
          (s) =>
            s.address === source.address &&
            s.network === source.network &&
            s.algorithm === source.algorithm,
        );
        if (existingSource) continue;

        const newSource = new Source(
          source.address,
          source.network,
          source.algorithm,
          source.creationBlockNumber,
        );

        await this.sourceService.create(newSource);
        this.logger.log(`Added new source: ${source.network}/${source.algorithm}`);
      }

      this.logger.log('Filling of source table completed.');
      return;
    } catch (error) {
      this.logger.error('An error occurred while filling source table:', error);
      return;
    }
  }
}
