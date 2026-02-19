import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceStartBlockEndBlock1760000000000 implements MigrationInterface {
  name = 'SourceStartBlockEndBlock1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" RENAME COLUMN "blockNumber" TO "startBlock"`);
    await queryRunner.query(`ALTER TABLE "source" ADD "endBlock" integer`);
    await queryRunner.query(`ALTER TABLE "source" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(`CREATE INDEX "IDX_source_deletedAt" ON "source" ("deletedAt")`);
    await queryRunner.query(`ALTER TABLE "asset" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(`CREATE INDEX "IDX_asset_deletedAt" ON "asset" ("deletedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_asset_deletedAt"`);
    await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_source_deletedAt"`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "endBlock"`);
    await queryRunner.query(`ALTER TABLE "source" RENAME COLUMN "startBlock" TO "blockNumber"`);
  }
}
