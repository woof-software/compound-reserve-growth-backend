import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1758721774397 implements MigrationInterface {
  name = 'Migration1758721774397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "oracles" ADD "assetId" integer`);
    await queryRunner.query(
      `ALTER TABLE "daily_aggregation" DROP CONSTRAINT "FK_f21da8fcdb54aaf6071098568f0"`,
    );
    await queryRunner.query(`ALTER TABLE "daily_aggregation" DROP COLUMN "sourceId"`);
    await queryRunner.query(
      `ALTER TABLE "oracles" ADD CONSTRAINT "FK_c04c234cf6e9f226f37a6c31fdf" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oracles" DROP CONSTRAINT "FK_c04c234cf6e9f226f37a6c31fdf"`,
    );
    await queryRunner.query(`ALTER TABLE "daily_aggregation" ADD "sourceId" integer`);
    await queryRunner.query(
      `ALTER TABLE "daily_aggregation" ADD CONSTRAINT "FK_f21da8fcdb54aaf6071098568f0" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "oracles" DROP COLUMN "assetId"`);
  }
}
