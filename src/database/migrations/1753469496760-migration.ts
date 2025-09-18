import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1753469496760 implements MigrationInterface {
  name = 'Migration1753469496760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "oracles" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "chainId" integer NOT NULL, "network" character varying NOT NULL, "description" character varying, "ratioProvider" character varying, "baseAggregator" character varying, "maxYearlyRatioGrowthPercent" integer, "snapshotRatio" numeric(78,0), "snapshotTimestamp" bigint, "minimumSnapshotDelay" integer, "decimals" integer, "manager" character varying, "isActive" boolean NOT NULL DEFAULT true, "discoveredAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3fad5ac30e30bac6c815a0a5ebf" UNIQUE ("address"), CONSTRAINT "PK_cf90ced5eeaadef2eb8a589c515" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3fad5ac30e30bac6c815a0a5eb" ON "oracles" ("address") `,
    );
    await queryRunner.query(
      `CREATE TABLE "oracle_snapshots" ("id" SERIAL NOT NULL, "oracleAddress" character varying NOT NULL, "oracleName" character varying NOT NULL, "chainId" integer NOT NULL, "ratio" numeric(78,0) NOT NULL, "price" numeric(78,0) NOT NULL, "snapshotRatio" numeric(78,0) NOT NULL, "snapshotTimestamp" bigint NOT NULL, "maxYearlyGrowthPercent" integer NOT NULL, "isCapped" boolean NOT NULL, "currentGrowthRate" numeric(10,4) NOT NULL, "blockNumber" integer, "metadata" jsonb, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f08fe83a1bba8c91a6bed44897" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c8eb24283a9850e4d543febff" ON "oracle_snapshots" ("oracleAddress") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7723d1bc275abe6ddb54ec939a" ON "oracle_snapshots" ("chainId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7587f53d6699c5f6ab533e5755" ON "oracle_snapshots" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7f987b73d28dedbc57fe5331e" ON "oracle_snapshots" ("chainId", "oracleAddress", "timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34011f41c511985d3727583311" ON "oracle_snapshots" ("oracleAddress", "timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_aggregation" ("id" SERIAL NOT NULL, "oracleAddress" character varying NOT NULL, "oracleName" character varying NOT NULL, "chainId" integer NOT NULL, "date" date NOT NULL, "avgRatio" numeric(78,0) NOT NULL, "minRatio" numeric(78,0) NOT NULL, "maxRatio" numeric(78,0) NOT NULL, "avgPrice" numeric(78,0) NOT NULL, "minPrice" numeric(78,0) NOT NULL, "maxPrice" numeric(78,0) NOT NULL, "cappedCount" integer NOT NULL, "totalCount" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f51808e2cc0e084c4053d20e71f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7cb9606c0e55cdf367c75c1c29" ON "daily_aggregation" ("oracleAddress", "date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "alerts" ("id" SERIAL NOT NULL, "oracleAddress" character varying NOT NULL, "chainId" integer NOT NULL, "type" character varying NOT NULL, "severity" character varying NOT NULL, "message" character varying NOT NULL, "data" jsonb, "status" character varying NOT NULL DEFAULT 'pending', "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "sentAt" TIMESTAMP, "error" character varying, CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a5c9a5a4e14b070e69d8beed71" ON "alerts" ("oracleAddress") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd334445d60987d7e5c7f49efc" ON "alerts" ("chainId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd39bea0ff020151ca975491db" ON "alerts" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6822a26b2b821ef939b82fd0d0" ON "alerts" ("type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_119171d09c864421eb90cd4f5e" ON "alerts" ("oracleAddress", "chainId", "timestamp") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_119171d09c864421eb90cd4f5e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6822a26b2b821ef939b82fd0d0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bd39bea0ff020151ca975491db"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fd334445d60987d7e5c7f49efc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a5c9a5a4e14b070e69d8beed71"`);
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7cb9606c0e55cdf367c75c1c29"`);
    await queryRunner.query(`DROP TABLE "daily_aggregation"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_34011f41c511985d3727583311"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d7f987b73d28dedbc57fe5331e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7587f53d6699c5f6ab533e5755"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7723d1bc275abe6ddb54ec939a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2c8eb24283a9850e4d543febff"`);
    await queryRunner.query(`DROP TABLE "oracle_snapshots"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3fad5ac30e30bac6c815a0a5eb"`);
    await queryRunner.query(`DROP TABLE "oracles"`);
  }
}
