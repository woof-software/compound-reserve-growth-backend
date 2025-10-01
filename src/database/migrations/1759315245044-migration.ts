import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1759315245044 implements MigrationInterface {
  name = 'Migration1759315245044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spends" ADD "priceComp" double precision`);
    await queryRunner.query(`ALTER TABLE "spends" ADD "supplyComp" double precision`);
    await queryRunner.query(`ALTER TABLE "spends" ADD "borrowComp" double precision`);

    await queryRunner.query(`UPDATE "spends" SET "priceComp" = 0 WHERE "priceComp" IS NULL`);
    await queryRunner.query(`UPDATE "spends" SET "supplyComp" = 0 WHERE "supplyComp" IS NULL`);
    await queryRunner.query(`UPDATE "spends" SET "borrowComp" = 0 WHERE "borrowComp" IS NULL`);

    await queryRunner.query(`ALTER TABLE "spends" ALTER COLUMN "priceComp" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "spends" ALTER COLUMN "supplyComp" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "spends" ALTER COLUMN "borrowComp" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "borrowComp"`);
    await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "supplyComp"`);
    await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "priceComp"`);
  }
}
