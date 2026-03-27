import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevenueProjection1774627200000 implements MigrationInterface {
  name = 'RevenueProjection1774627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE "revenue" RESTART IDENTITY`);
    await queryRunner.query(`ALTER TABLE "revenue" RENAME COLUMN "quantity" TO "quantityDelta"`);
    await queryRunner.query(`ALTER TABLE "revenue" ADD "reserveId" integer NOT NULL`);
    await queryRunner.query(`ALTER TABLE "revenue" ADD "updatedAt" TIMESTAMP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "revenue" ALTER COLUMN "sourceId" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "revenue" ADD CONSTRAINT "FK_revenue_reserveId" FOREIGN KEY ("reserveId") REFERENCES "reserves"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_revenue_reserveId" ON "revenue" ("reserveId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_revenue_sourceId_date" ON "revenue" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revenue_date_source_id" ON "revenue" ("date", "sourceId", "id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "incentives" ("id" SERIAL NOT NULL, "reserveId" integer, "spendId" integer, "incomes" double precision NOT NULL, "rewardsSupply" double precision NOT NULL, "rewardsBorrow" double precision NOT NULL, "priceComp" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "sourceId" integer NOT NULL, CONSTRAINT "CHK_incentives_source_row" CHECK ("reserveId" IS NOT NULL OR "spendId" IS NOT NULL), CONSTRAINT "PK_incentives_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "incentives" ADD CONSTRAINT "FK_incentives_sourceId" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incentives" ADD CONSTRAINT "FK_incentives_reserveId" FOREIGN KEY ("reserveId") REFERENCES "reserves"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incentives" ADD CONSTRAINT "FK_incentives_spendId" FOREIGN KEY ("spendId") REFERENCES "spends"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_incentives_sourceId_date" ON "incentives" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_incentives_date_source_id" ON "incentives" ("date", "sourceId", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_incentives_date_source_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_incentives_sourceId_date"`);
    await queryRunner.query(`ALTER TABLE "incentives" DROP CONSTRAINT "FK_incentives_spendId"`);
    await queryRunner.query(`ALTER TABLE "incentives" DROP CONSTRAINT "FK_incentives_reserveId"`);
    await queryRunner.query(`ALTER TABLE "incentives" DROP CONSTRAINT "FK_incentives_sourceId"`);
    await queryRunner.query(`DROP TABLE "incentives"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_revenue_date_source_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_revenue_sourceId_date"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_revenue_reserveId"`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP CONSTRAINT "FK_revenue_reserveId"`);
    await queryRunner.query(`ALTER TABLE "revenue" ALTER COLUMN "sourceId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN "reserveId"`);
    await queryRunner.query(`ALTER TABLE "revenue" RENAME COLUMN "quantityDelta" TO "quantity"`);
  }
}
