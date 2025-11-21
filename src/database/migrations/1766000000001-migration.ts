import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1766000000001 implements MigrationInterface {
  name = 'Migration1766000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_key_usage_events" (
        "id" SERIAL NOT NULL,
        "apiKey" character varying(64) NOT NULL,
        "clientName" character varying(64),
        "method" character varying(10) NOT NULL,
        "targetUrl" text NOT NULL,
        "statusCode" integer NOT NULL,
        "ip" character varying(64),
        "domain" character varying(255),
        "host" character varying(255),
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_key_usage_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_api_key_usage_events_apiKey_createdAt"
      ON "api_key_usage_events" ("apiKey", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_api_key_usage_events_apiKey_createdAt"`);
    await queryRunner.query(`DROP TABLE "api_key_usage_events"`);
  }
}
