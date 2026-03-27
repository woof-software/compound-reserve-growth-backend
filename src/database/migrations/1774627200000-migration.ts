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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
