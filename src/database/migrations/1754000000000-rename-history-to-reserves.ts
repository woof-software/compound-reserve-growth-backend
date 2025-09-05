import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameHistoryToReserves1754000000000 implements MigrationInterface {
  name = 'RenameHistoryToReserves1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "history" RENAME TO "reserves"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reserves" RENAME TO "history"`);
  }
}
