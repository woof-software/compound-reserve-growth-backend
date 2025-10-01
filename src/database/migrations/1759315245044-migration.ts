import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1759315245044 implements MigrationInterface {
  name = 'Migration1759315245044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spends" ADD "priceComp" double precision NOT NULL`);
    await queryRunner.query(`ALTER TABLE "spends" ADD "supplyComp" double precision NOT NULL`);
    await queryRunner.query(`ALTER TABLE "spends" ADD "borrowComp" double precision NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "borrowComp"`);
    await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "supplyComp"`);
    await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "priceComp"`);
  }
}
