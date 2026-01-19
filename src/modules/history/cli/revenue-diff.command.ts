import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { promises as fs } from 'fs';
import path from 'path';

import { DAY_IN_MS } from '@/common/constants';
import { dayId } from '@/common/utils/day-id';
import { Algorithm } from '@/common/enum/algorithm.enum';

import {
  ReservesRepository,
  RevenueAnomalyRow,
  RevenueByDayRow,
} from '../reserves-repository.service';

type RevenueTotalsByDay = {
  address: string;
  totals: Map<number, number>;
};

@Command({
  name: 'history:revenue-diff',
  description: 'Compare selected day revenue vs previous day and write anomalies',
})
export class RevenueDiffCommand extends CommandRunner {
  private readonly logger = new Logger(RevenueDiffCommand.name);
  private readonly thresholdUsd = 1_000_000;

  constructor(private readonly reservesRepo: ReservesRepository) {
    super();
  }

  async run(params: string[]): Promise<void> {
    const [dateInput, outputPathInput, thresholdInput] = params;
    const isAllDays = !dateInput || dateInput.toLowerCase() === 'all';

    if (isAllDays) {
      const allArgs = dateInput ? params.slice(1) : params;
      const [allOutputPath, allThreshold] = allArgs;
      let threshold = this.thresholdUsd;
      let outputPath = path.resolve(process.cwd(), `revenue-diff-all.csv`);

      if (allOutputPath) {
        if (allThreshold) {
          outputPath = path.resolve(allOutputPath);
          if (!Number.isNaN(Number(allThreshold))) {
            threshold = Number(allThreshold);
          }
        } else if (!Number.isNaN(Number(allOutputPath))) {
          threshold = Number(allOutputPath);
        } else {
          outputPath = path.resolve(allOutputPath);
        }
      }

      const anomalies = await this.reservesRepo.getRevenueAnomaliesAllDays(
        threshold,
        [Algorithm.COMET, Algorithm.MARKET_V2, Algorithm.AERA_COMPOUND_RESERVES],
      );

      await this.writeCsvAllDays(outputPath, anomalies);

      this.logger.log(
        `Checked all days. Found ${anomalies.length} anomalies. Output: ${outputPath}`,
      );
      return;
    }

    const targetStart = this.parseToUtcDayStart(dateInput);
    if (!targetStart) {
      this.logger.error(
        'Invalid date. Use YYYY-MM-DD or epoch seconds/milliseconds. Or omit date / use "all" to scan all days.',
      );
      return;
    }

    const threshold =
      thresholdInput && !Number.isNaN(Number(thresholdInput))
        ? Number(thresholdInput)
        : this.thresholdUsd;

    const previousStart = new Date(targetStart.getTime() - DAY_IN_MS);
    const targetDayEnd = new Date(targetStart.getTime() + DAY_IN_MS);
    const targetDayId = dayId(targetStart);
    const previousDayId = dayId(previousStart);

    const rows = await this.reservesRepo.getRevenueRowsForDayIds(
      [previousDayId, targetDayId],
      targetDayEnd,
      [Algorithm.COMET, Algorithm.MARKET_V2, Algorithm.AERA_COMPOUND_RESERVES],
    );

    const totalsBySource = this.buildTotalsBySource(rows);
    const anomalies = this.findAnomalies(
      totalsBySource,
      targetDayId,
      previousDayId,
      threshold,
    );

    const dateLabel = targetStart.toISOString().slice(0, 10);
    const outputPath = outputPathInput
      ? path.resolve(outputPathInput)
      : path.resolve(process.cwd(), `revenue-diff-${dateLabel}.csv`);

    await this.writeCsv(outputPath, dateLabel, anomalies);

    this.logger.log(
      `Checked ${totalsBySource.size} sources. Found ${anomalies.length} anomalies. Output: ${outputPath}`,
    );
  }

  private buildTotalsBySource(rows: RevenueByDayRow[]): Map<number, RevenueTotalsByDay> {
    const totals = new Map<number, RevenueTotalsByDay>();

    rows.forEach((row) => {
      const existing = totals.get(row.sourceId);
      if (!existing) {
        totals.set(row.sourceId, {
          address: row.address,
          totals: new Map<number, number>([[row.dayId, row.revenue]]),
        });
        return;
      }

      const current = existing.totals.get(row.dayId) ?? 0;
      existing.totals.set(row.dayId, current + row.revenue);
    });

    return totals;
  }

  private findAnomalies(
    totalsBySource: Map<number, RevenueTotalsByDay>,
    targetDayId: number,
    previousDayId: number,
    threshold: number,
  ): Array<{
    sourceId: number;
    address: string;
    targetUsd: number;
    previousUsd: number;
    deltaUsd: number;
  }> {
    const anomalies: Array<{
      sourceId: number;
      address: string;
      targetUsd: number;
      previousUsd: number;
      deltaUsd: number;
    }> = [];

    totalsBySource.forEach((data, sourceId) => {
      const targetUsd = data.totals.get(targetDayId);
      const previousUsd = data.totals.get(previousDayId);
      if (targetUsd === undefined || previousUsd === undefined) {
        return;
      }

      const deltaUsd = Math.abs(targetUsd - previousUsd);
      if (deltaUsd > threshold) {
        anomalies.push({
          sourceId,
          address: data.address,
          targetUsd,
          previousUsd,
          deltaUsd,
        });
      }
    });

    return anomalies;
  }

  private async writeCsv(
    outputPath: string,
    dateLabel: string,
    anomalies: Array<{
      sourceId: number;
      address: string;
      targetUsd: number;
      previousUsd: number;
      deltaUsd: number;
    }>,
  ): Promise<void> {
    const lines = [
      'date,address,sourceId,deltaUsd,targetUsd,previousUsd',
      ...anomalies.map((item) =>
        [
          dateLabel,
          item.address,
          item.sourceId,
          item.deltaUsd.toFixed(2),
          item.targetUsd.toFixed(2),
          item.previousUsd.toFixed(2),
        ].join(','),
      ),
    ];

    await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  }

  private async writeCsvAllDays(
    outputPath: string,
    anomalies: RevenueAnomalyRow[],
  ): Promise<void> {
    const lines = [
      'date,address,sourceId,deltaUsd,targetUsd,previousUsd',
      ...anomalies.map((item) => {
        const dayId = Number(item.dayId);
        const dateLabel = new Date(dayId * DAY_IN_MS).toISOString().slice(0, 10);
        return [
          dateLabel,
          item.address,
          item.sourceId,
          Number(item.deltaUsd).toFixed(2),
          Number(item.total).toFixed(2),
          Number(item.prevTotal).toFixed(2),
        ].join(',');
      }),
    ];

    await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  }

  private parseToUtcDayStart(input: string): Date | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (/^\d{10}$/.test(trimmed)) {
      const seconds = Number(trimmed);
      return this.toUtcDayStart(new Date(seconds * 1000));
    }

    if (/^\d{13}$/.test(trimmed)) {
      const ms = Number(trimmed);
      return this.toUtcDayStart(new Date(ms));
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateMatch) {
      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]) - 1;
      const day = Number(dateMatch[3]);
      return new Date(Date.UTC(year, month, day));
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return this.toUtcDayStart(parsed);
  }

  private toUtcDayStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
