import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservesUpdatedAt1775520000000 implements MigrationInterface {
  name = 'AddReservesUpdatedAt1775520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reserves" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`UPDATE "reserves" SET "updatedAt" = "createdAt"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_reserves_updatedAt_id" ON "reserves" ("updatedAt", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_reserves_updatedAt_id"`);
    await queryRunner.query(`ALTER TABLE "reserves" DROP COLUMN "updatedAt"`);
  }
}
