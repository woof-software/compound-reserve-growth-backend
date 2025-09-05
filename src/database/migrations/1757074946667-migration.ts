import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757074946667 implements MigrationInterface {
    name = 'Migration1757074946667'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reserves" DROP CONSTRAINT "FK_7a25496d0f369261e67a2a36fe9"`);
        await queryRunner.query(`CREATE TABLE "incomes" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantitySupply" numeric NOT NULL, "quantityBorrow" numeric NOT NULL, "price" double precision NOT NULL, "valueSupply" double precision NOT NULL, "valueBorrow" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, CONSTRAINT "PK_d737b3d0314c1f0da5461a55e5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "spends" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantitySupply" numeric NOT NULL, "quantityBorrow" numeric NOT NULL, "price" double precision NOT NULL, "valueSupply" double precision NOT NULL, "valueBorrow" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, CONSTRAINT "PK_d3745a4ae94fb27ca026b2103e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "reserves_id_seq" OWNED BY "reserves"."id"`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" SET DEFAULT nextval('"reserves_id_seq"')`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "reserves" ADD CONSTRAINT "FK_b58ee92dc5c4f490d7b186a8412" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD CONSTRAINT "FK_9707a2df523e0e72d0d60c91653" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "spends" ADD CONSTRAINT "FK_858bc1de2c14c03be58bd99e740" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spends" DROP CONSTRAINT "FK_858bc1de2c14c03be58bd99e740"`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP CONSTRAINT "FK_9707a2df523e0e72d0d60c91653"`);
        await queryRunner.query(`ALTER TABLE "reserves" DROP CONSTRAINT "FK_b58ee92dc5c4f490d7b186a8412"`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" SET DEFAULT nextval('history_id_seq')`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "reserves_id_seq"`);
        await queryRunner.query(`DROP TABLE "spends"`);
        await queryRunner.query(`DROP TABLE "incomes"`);
        await queryRunner.query(`ALTER TABLE "reserves" ADD CONSTRAINT "FK_7a25496d0f369261e67a2a36fe9" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
