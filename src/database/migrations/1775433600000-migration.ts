import { MigrationInterface, QueryRunner } from 'typeorm';

export class DailyHistoryUniqueness1775433600000 implements MigrationInterface {
  name = 'DailyHistoryUniqueness1775433600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_reserves_sourceId_date_id_helper" ON "reserves" ("sourceId", "date", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_incomes_sourceId_date_id_helper" ON "incomes" ("sourceId", "date", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_spends_sourceId_date_id_helper" ON "spends" ("sourceId", "date", "id")`,
    );

    await queryRunner.query(`
      CREATE TEMP TABLE "reserve_keepers" ON COMMIT DROP AS
      SELECT DISTINCT ON ("sourceId", "date")
        "sourceId",
        "date",
        id AS keep_id
      FROM "reserves"
      ORDER BY "sourceId", "date", id DESC
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reserve_keepers_sourceId_date" ON "reserve_keepers" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reserve_keepers_keep_id" ON "reserve_keepers" ("keep_id")`,
    );
    await queryRunner.query(`
      CREATE TEMP TABLE "income_keepers" ON COMMIT DROP AS
      SELECT DISTINCT ON ("sourceId", "date")
        "sourceId",
        "date",
        id AS keep_id
      FROM "incomes"
      ORDER BY "sourceId", "date", id DESC
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_income_keepers_sourceId_date" ON "income_keepers" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_income_keepers_keep_id" ON "income_keepers" ("keep_id")`,
    );
    await queryRunner.query(`
      CREATE TEMP TABLE "spend_keepers" ON COMMIT DROP AS
      SELECT DISTINCT ON ("sourceId", "date")
        "sourceId",
        "date",
        id AS keep_id
      FROM "spends"
      ORDER BY "sourceId", "date", id DESC
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_spend_keepers_sourceId_date" ON "spend_keepers" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_spend_keepers_keep_id" ON "spend_keepers" ("keep_id")`,
    );

    await queryRunner.query(`
      UPDATE "revenue" AS revenue
      SET "reserveId" = "reserve_keepers".keep_id
      FROM "reserve_keepers"
      WHERE revenue."sourceId" = "reserve_keepers"."sourceId"
        AND revenue."date" = "reserve_keepers"."date"
        AND revenue."reserveId" <> "reserve_keepers".keep_id
    `);
    await queryRunner.query(`
      UPDATE "incentives" AS incentives
      SET "reserveId" = "reserve_keepers".keep_id
      FROM "reserve_keepers"
      WHERE incentives."reserveId" IS NOT NULL
        AND incentives."sourceId" = "reserve_keepers"."sourceId"
        AND incentives."date" = "reserve_keepers"."date"
        AND incentives."reserveId" <> "reserve_keepers".keep_id
    `);
    await queryRunner.query(`
      UPDATE "incentives" AS incentives
      SET "spendId" = "spend_keepers".keep_id
      FROM "spend_keepers"
      WHERE incentives."spendId" IS NOT NULL
        AND incentives."sourceId" = "spend_keepers"."sourceId"
        AND incentives."date" = "spend_keepers"."date"
        AND incentives."spendId" <> "spend_keepers".keep_id
    `);

    await queryRunner.query(`
      DELETE FROM "reserves" AS reserves
      WHERE NOT EXISTS (
        SELECT 1
        FROM "reserve_keepers"
        WHERE "reserve_keepers".keep_id = reserves.id
      )
    `);
    await queryRunner.query(`
      DELETE FROM "incomes" AS incomes
      WHERE NOT EXISTS (
        SELECT 1
        FROM "income_keepers"
        WHERE "income_keepers".keep_id = incomes.id
      )
    `);
    await queryRunner.query(`
      DELETE FROM "spends" AS spends
      WHERE NOT EXISTS (
        SELECT 1
        FROM "spend_keepers"
        WHERE "spend_keepers".keep_id = spends.id
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reserves_sourceId_date" ON "reserves" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_incomes_sourceId_date" ON "incomes" ("sourceId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_spends_sourceId_date" ON "spends" ("sourceId", "date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_reserves_date_source_id" ON "reserves" ("date", "sourceId", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_incomes_date_source_id" ON "incomes" ("date", "sourceId", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_spends_date_source_id" ON "spends" ("date", "sourceId", "id")`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_spends_sourceId_date_id_helper"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_incomes_sourceId_date_id_helper"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reserves_sourceId_date_id_helper"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_spends_date_source_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_incomes_date_source_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reserves_date_source_id"`);

    await queryRunner.query(`DROP INDEX "public"."UQ_spends_sourceId_date"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_incomes_sourceId_date"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_reserves_sourceId_date"`);
  }
}
