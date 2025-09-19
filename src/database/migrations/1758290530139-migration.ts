import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1758290530139 implements MigrationInterface {
  name = 'Migration1758290530139';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ALTER COLUMN "algorithm" TYPE text[] USING (CASE WHEN "algorithm" IS NULL THEN NULL ELSE ARRAY["algorithm"] END)`,
    );
    await queryRunner.query(`ALTER TABLE "history" RENAME TO "reserves"`);
    await queryRunner.query(
      `CREATE TABLE "incomes" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantitySupply" numeric NOT NULL, "quantityBorrow" numeric NOT NULL, "price" double precision NOT NULL, "valueSupply" double precision NOT NULL, "valueBorrow" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, CONSTRAINT "PK_d737b3d0314c1f0da5461a55e5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "spends" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantitySupply" numeric NOT NULL, "quantityBorrow" numeric NOT NULL, "price" double precision NOT NULL, "valueSupply" double precision NOT NULL, "valueBorrow" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, CONSTRAINT "PK_d3745a4ae94fb27ca026b2103e5" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ALTER COLUMN "algorithm" TYPE text USING (CASE WHEN "algorithm" IS NULL OR array_length("algorithm", 1) = 0 THEN NULL ELSE "algorithm"[1] END)`,
    );
    await queryRunner.query(`ALTER TABLE "reserves" RENAME TO "history"`);
    await queryRunner.query(`DROP TABLE "spends"`);
    await queryRunner.query(`DROP TABLE "incomes"`);
  }
}
