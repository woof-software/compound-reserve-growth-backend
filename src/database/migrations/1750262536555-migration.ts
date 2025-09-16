import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1750262536555 implements MigrationInterface {
  name = 'Migration1750262536555';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "treasury" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantity" numeric NOT NULL, "price" double precision NOT NULL, "value" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, "assetId" integer, CONSTRAINT "PK_55655557260341eb45eb7306810" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "revenue" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantity" numeric NOT NULL, "price" double precision NOT NULL, "value" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, "assetId" integer, CONSTRAINT "PK_843523949384ce16042013dacc7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "asset" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "decimals" integer NOT NULL, "symbol" character varying NOT NULL, "chain" character varying NOT NULL, "type" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_1209d107fe21482beaea51b745e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "history" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantity" numeric NOT NULL, "price" double precision NOT NULL, "value" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, "assetId" integer, CONSTRAINT "PK_9384942edf4804b38ca0ee51416" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "source" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "market" character varying, "algorithm" character varying NOT NULL, "blockNumber" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL, "checkedAt" TIMESTAMP, CONSTRAINT "PK_018c433f8264b58c86363eaadde" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "treasury" ADD CONSTRAINT "FK_4d7fe865d50d2ccb7ac868e3653" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "treasury" ADD CONSTRAINT "FK_ac73aac54e2e0ed182a7cc756b8" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revenue" ADD CONSTRAINT "FK_ebbc021a2783b7a390f3ad4875b" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revenue" ADD CONSTRAINT "FK_12dfc07e7449cd7056fad16bd55" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_7a25496d0f369261e67a2a36fe9" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" ADD CONSTRAINT "FK_c3f971dfbbf29d26467200b9e5a" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_c3f971dfbbf29d26467200b9e5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "history" DROP CONSTRAINT "FK_7a25496d0f369261e67a2a36fe9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "revenue" DROP CONSTRAINT "FK_12dfc07e7449cd7056fad16bd55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "revenue" DROP CONSTRAINT "FK_ebbc021a2783b7a390f3ad4875b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treasury" DROP CONSTRAINT "FK_ac73aac54e2e0ed182a7cc756b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "treasury" DROP CONSTRAINT "FK_4d7fe865d50d2ccb7ac868e3653"`,
    );
    await queryRunner.query(`DROP TABLE "source"`);
    await queryRunner.query(`DROP TABLE "history"`);
    await queryRunner.query(`DROP TABLE "asset"`);
    await queryRunner.query(`DROP TABLE "revenue"`);
    await queryRunner.query(`DROP TABLE "treasury"`);
  }
}
