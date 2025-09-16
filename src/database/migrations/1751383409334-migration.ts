import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1751383409334 implements MigrationInterface {
  name = 'Migration1751383409334';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" ADD "type" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "type"`);
  }
}
