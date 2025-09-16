import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1750686431861 implements MigrationInterface {
  name = 'Migration1750686431861';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_c3f971dfbbf29d26467200b9e5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "revenue" DROP CONSTRAINT "FK_12dfc07e7449cd7056fad16bd55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treasury" DROP CONSTRAINT "FK_ac73aac54e2e0ed182a7cc756b8"`,
    );
    await queryRunner.query(`ALTER TABLE "history" DROP COLUMN "assetId"`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN "assetId"`);
    await queryRunner.query(`ALTER TABLE "treasury" DROP COLUMN "assetId"`);
    await queryRunner.query(`ALTER TABLE "source" ADD "assetId" integer`);
    await queryRunner.query(`ALTER TABLE "asset" ALTER COLUMN "type" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "source" ADD CONSTRAINT "FK_27ed7f3ac67cd73eb2077a5d3ea" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" DROP CONSTRAINT "FK_27ed7f3ac67cd73eb2077a5d3ea"`,
    );
    await queryRunner.query(`ALTER TABLE "asset" ALTER COLUMN "type" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "assetId"`);
    await queryRunner.query(`ALTER TABLE "treasury" ADD "assetId" integer`);
    await queryRunner.query(`ALTER TABLE "revenue" ADD "assetId" integer`);
    await queryRunner.query(`ALTER TABLE "history" ADD "assetId" integer`);
    await queryRunner.query(
      `ALTER TABLE "treasury" ADD CONSTRAINT "FK_ac73aac54e2e0ed182a7cc756b8" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revenue" ADD CONSTRAINT "FK_12dfc07e7449cd7056fad16bd55" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_c3f971dfbbf29d26467200b9e5a" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
