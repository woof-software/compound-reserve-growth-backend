import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceStartBlockEndBlock1760000000000 implements MigrationInterface {
  name = 'SourceStartBlockEndBlock1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" RENAME COLUMN "blockNumber" TO "startBlock"`);
    await queryRunner.query(`ALTER TABLE "source" ADD "endBlock" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "endBlock"`);
    await queryRunner.query(`ALTER TABLE "source" RENAME COLUMN "startBlock" TO "blockNumber"`);
  }
}
