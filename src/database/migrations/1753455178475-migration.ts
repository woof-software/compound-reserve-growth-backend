import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1753455178475 implements MigrationInterface {
  name = 'Migration1753455178475';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "price" ("id" SERIAL NOT NULL, "symbol" character varying NOT NULL, "price" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_d163e55e8cce6908b2e0f27cea4" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "price"`);
  }
}
