import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757083021519 implements MigrationInterface {
    name = 'Migration1757083021519'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "incomes" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantitySupply" numeric NOT NULL, "quantityBorrow" numeric NOT NULL, "price" double precision NOT NULL, "valueSupply" double precision NOT NULL, "valueBorrow" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, CONSTRAINT "PK_d737b3d0314c1f0da5461a55e5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "spends" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "quantitySupply" numeric NOT NULL, "quantityBorrow" numeric NOT NULL, "price" double precision NOT NULL, "valueSupply" double precision NOT NULL, "valueBorrow" double precision NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "sourceId" integer, CONSTRAINT "PK_d3745a4ae94fb27ca026b2103e5" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spends" DROP CONSTRAINT "FK_858bc1de2c14c03be58bd99e740"`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP CONSTRAINT "FK_9707a2df523e0e72d0d60c91653"`);
        await queryRunner.query(`DROP TABLE "spends"`);
        await queryRunner.query(`DROP TABLE "incomes"`);
    }
}
