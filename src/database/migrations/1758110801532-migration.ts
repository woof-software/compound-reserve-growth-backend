import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1758110801532 implements MigrationInterface {
  name = 'Migration1758110801532';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ALTER COLUMN "algorithm" TYPE text[] USING (CASE WHEN "algorithm" IS NULL THEN NULL ELSE ARRAY["algorithm"] END)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ALTER COLUMN "algorithm" TYPE text USING (CASE WHEN "algorithm" IS NULL OR array_length("algorithm", 1) = 0 THEN NULL ELSE "algorithm"[1] END)`,
    );
  }
}
