import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ProviderFactory } from 'modules/network/provider.factory';
import { NetworkService } from 'modules/network/network.service';
import { SourceRepository } from 'modules/source/source.repository';
import CometABI from 'modules/contract/abi/CometABI.json';
import CapoABI from 'modules/capo/abi/ERC4626CorrelatedAssetsPriceOracle.json';

import { Algorithm } from 'common/enum/algorithm.enum';

import { Oracle } from './oracle.entity';

interface CapoOracleInfo {
  address: string;
  chainId: number;
  network: string;
  description: string;
  ratioProvider: string;
  baseAggregator: string;
  maxYearlyRatioGrowthPercent: number;
  snapshotRatio: string;
  snapshotTimestamp: number;
  minimumSnapshotDelay: number;
  decimals: number;
  manager: string;
}

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly networkService: NetworkService,
    private readonly sourceRepository: SourceRepository,
    @InjectRepository(Oracle) private readonly oracleRepository: Repository<Oracle>,
  ) {}

  async onModuleInit() {
    // if (process.env.MOCK_CAPO === 'true') {
    //   await this.oracleRepository.upsert(
    //     {
    //       address: '0x1111111111111111111111111111111111111111',
    //       chainId: 1,
    //       network: 'mainnet',
    //       description: 'Mock CAPO',
    //       maxYearlyRatioGrowthPercent: 500,
    //       snapshotRatio: '1000000000000000000',
    //       snapshotTimestamp: Math.floor(Date.now() / 1_000),
    //       decimals: 18,
    //       isActive: true,
    //     },
    //     ['address'],
    //   );
    // }
    // this.logger.log('DiscoveryService initialized');

    // const standaloneOracleAddress = '0xdd5b1151ef4808137b0b6e80765192b62968e643'.toLowerCase();

    // try {
    //   await this.oracleRepository.upsert(
    //     {
    //       address: standaloneOracleAddress,
    //       chainId: 1,
    //       network: 'mainnet',
    //       description: 'wstETH / USD Oracle',
    //       isActive: true,
    //     },
    //     ['address'],
    //   );

    //   const oracleRow = await this.oracleRepository.findOne({
    //     where: { address: standaloneOracleAddress },
    //   });

    //   if (oracleRow && (!oracleRow.snapshotRatio || !oracleRow.decimals)) {
    //     try {
    //       const provider = this.providerFactory.get('mainnet');
    //       const oracleContract = new ethers.Contract(standaloneOracleAddress, CapoABI, provider);
    //       const [
    //         snapshotRatioBn,
    //         snapshotTimestampBn,
    //         decimals,
    //         minDelay,
    //         ratioProvider,
    //         baseAgg,
    //         maxYearlyRatioGrowthPercent,
    //         snapshotTimestamp,
    //       ] = await Promise.all([
    //         oracleContract.snapshotRatio(),
    //         oracleContract.snapshotTimestamp(),
    //         oracleContract.decimals(),
    //         oracleContract.minimumSnapshotDelay(),
    //         oracleContract.ratioProvider(),
    //         oracleContract.assetToBaseAggregator(),
    //         oracleContract.maxYearlyRatioGrowthPercent(),
    //         oracleContract.snapshotTimestamp(),
    //       ]);

    //       oracleRow.snapshotRatio = snapshotRatioBn.toString();
    //       oracleRow.snapshotTimestamp = Number(snapshotTimestampBn);
    //       oracleRow.decimals = Number(decimals);
    //       oracleRow.minimumSnapshotDelay = Number(minDelay);
    //       oracleRow.ratioProvider = ratioProvider.toLowerCase();
    //       oracleRow.baseAggregator = baseAgg.toLowerCase();
    //       oracleRow.maxYearlyRatioGrowthPercent = Number(maxYearlyRatioGrowthPercent);
    //       oracleRow.snapshotTimestamp = Number(snapshotTimestamp);

    //       await this.oracleRepository.save(oracleRow);
    //       this.logger.log(`Oracle ${standaloneOracleAddress} initialised from on-chain data`);
    //     } catch (e) {
    //       this.logger.warn(`Could not fetch on-chain oracle data: ${e.message}`);
    //     }
    //   }

    //   this.logger.log(`Standalone oracle ${standaloneOracleAddress} upserted`);
    // } catch (e) {
    //   this.logger.error(`Failed to upsert standalone oracle: ${e.message}`);
    // }
    await this.syncFromSources();
    this.logger.log('Initial discovery completed');
  }
  async syncFromSources(): Promise<CapoOracleInfo[]> {
    const sources = await this.sourceRepository.list();
    const comets = sources.filter((s) => s.algorithm === Algorithm.COMET);

    this.logger.log(`Found ${comets.length} COMET sources for discovery`);

    if (comets.length === 0) {
      this.logger.warn('No COMET sources found for discovery.');
      return [];
    }

    const cometDescriptors = comets.map((c) => {
      const netCfg = this.networkService.byName(c.network);
      return {
        address: c.address,
        chainId: netCfg?.chainId ?? 0,
        network: c.network,
      };
    });

    this.logger.log(`Running CAPO discovery for ${cometDescriptors.length} comets`);
    return this.discoverCapoOracles(cometDescriptors);
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledSync() {
    await this.syncFromSources();
  }

  async discoverCapoOracles(
    cometAddresses: { address: string; chainId: number; network: string }[],
  ): Promise<CapoOracleInfo[]> {
    const discoveredOracles: CapoOracleInfo[] = [];
    const checkedAddresses = new Set<string>();

    for (const comet of cometAddresses) {
      try {
        this.logger.log(`Checking Comet ${comet.address} on ${comet.network}`);

        const provider = this.providerFactory.get(comet.network);
        const cometContract = new ethers.Contract(comet.address, CometABI, provider);

        const baseTokenPriceFeed = await cometContract.baseTokenPriceFeed();

        if (!checkedAddresses.has(baseTokenPriceFeed.toLowerCase())) {
          checkedAddresses.add(baseTokenPriceFeed.toLowerCase());

          const oracleInfo = await this.checkIfCapoOracle(
            baseTokenPriceFeed,
            comet.chainId,
            comet.network,
          );

          if (oracleInfo) {
            await this.oracleRepository.upsert(oracleInfo, ['address']);
            discoveredOracles.push(oracleInfo);
            this.logger.log(
              `Found CAPO oracle at ${baseTokenPriceFeed}: ${oracleInfo.description}`,
            );
          }
        }

        const numAssets = await cometContract.numAssets();

        for (let i = 0; i < numAssets; i++) {
          const assetInfo = await cometContract.getAssetInfo(i);
          const priceFeed = assetInfo.priceFeed;

          if (!checkedAddresses.has(priceFeed.toLowerCase())) {
            checkedAddresses.add(priceFeed.toLowerCase());

            const oracleInfo = await this.checkIfCapoOracle(
              priceFeed,
              comet.chainId,
              comet.network,
            );

            if (oracleInfo) {
              await this.oracleRepository.upsert(oracleInfo, ['address']);
              discoveredOracles.push(oracleInfo);
              this.logger.log(`Found CAPO oracle at ${priceFeed}: ${oracleInfo.description}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to check Comet ${comet.address}:`, error);
      }
    }

    return discoveredOracles;
  }

  private async checkIfCapoOracle(
    oracleAddress: string,
    chainId: number,
    network: string,
  ): Promise<CapoOracleInfo | null> {
    try {
      const provider = this.providerFactory.get(network);
      const oracleContract = new ethers.Contract(oracleAddress, CapoABI, provider);

      let maxYearlyRatioGrowthPercent: number;
      try {
        maxYearlyRatioGrowthPercent = await oracleContract.maxYearlyRatioGrowthPercent();
      } catch {
        return null;
      }

      // Sequential RPC calls to avoid excessive parallel requests
      const description = await oracleContract.description();
      const ratioProvider = await oracleContract.ratioProvider();
      const baseAggregator = await oracleContract.assetToBaseAggregator();
      const manager = await oracleContract.manager();
      const snapshotRatio = await oracleContract.snapshotRatio();
      const snapshotTimestamp = await oracleContract.snapshotTimestamp();
      const minimumSnapshotDelay = await oracleContract.minimumSnapshotDelay();
      const decimals = await oracleContract.decimals();

      const oracleInfo: CapoOracleInfo = {
        address: oracleAddress,
        chainId,
        network,
        description,
        ratioProvider,
        baseAggregator,
        maxYearlyRatioGrowthPercent,
        snapshotRatio: snapshotRatio.toString(),
        snapshotTimestamp: Number(snapshotTimestamp),
        minimumSnapshotDelay: Number(minimumSnapshotDelay),
        decimals: Number(decimals),
        manager,
      };

      return oracleInfo;
    } catch (error) {
      this.logger.error(`Error checking oracle ${oracleAddress}:`, error.message);
      return null;
    }
  }
}
