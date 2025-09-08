import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757340312298 implements MigrationInterface {
    name = 'Migration1757340312298'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reserves" DROP CONSTRAINT "FK_7a25496d0f369261e67a2a36fe9"`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "reserves_id_seq" OWNED BY "reserves"."id"`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" SET DEFAULT nextval('"reserves_id_seq"')`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "reserves" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "reserves" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "spends" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "revenue" ADD "date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "treasury" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "treasury" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "asset" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "source" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "event" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "price" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "price" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "oracle_snapshots" ALTER COLUMN "price" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "reserves" ADD CONSTRAINT "FK_b58ee92dc5c4f490d7b186a8412" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD CONSTRAINT "FK_9707a2df523e0e72d0d60c91653" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "spends" ADD CONSTRAINT "FK_858bc1de2c14c03be58bd99e740" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spends" DROP CONSTRAINT "FK_858bc1de2c14c03be58bd99e740"`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP CONSTRAINT "FK_9707a2df523e0e72d0d60c91653"`);
        await queryRunner.query(`ALTER TABLE "reserves" DROP CONSTRAINT "FK_b58ee92dc5c4f490d7b186a8412"`);
        await queryRunner.query(`ALTER TABLE "oracle_snapshots" ALTER COLUMN "price" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "price" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "price" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "event" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "source" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "asset" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "treasury" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "treasury" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "revenue" ADD "date" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "spends" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "spends" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reserves" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "reserves" ADD "createdAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" SET DEFAULT nextval('history_id_seq')`);
        await queryRunner.query(`ALTER TABLE "reserves" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "reserves_id_seq"`);
        await queryRunner.query(`ALTER TABLE "reserves" ADD CONSTRAINT "FK_7a25496d0f369261e67a2a36fe9" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
