import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1762450119382 implements MigrationInterface {
  name = 'Migration1762450119382';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_keys" (
        "id" SERIAL NOT NULL,
        "clientName" character varying(24) NOT NULL,
        "key" character varying(64) NOT NULL,
        "ipWhitelist" jsonb NOT NULL,
        "domainWhitelist" jsonb NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_api_keys_key" UNIQUE ("key"),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_clientName" ON "api_keys" ("clientName")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_key" ON "api_keys" ("key")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_status" ON "api_keys" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_api_keys_status"`);
    await queryRunner.query(`DROP INDEX "IDX_api_keys_key"`);
    await queryRunner.query(`DROP INDEX "IDX_api_keys_clientName"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
