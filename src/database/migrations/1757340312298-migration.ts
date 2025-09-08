import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757340312298 implements MigrationInterface {
    name = 'Migration1757340312298'

    public async up(queryRunner: QueryRunner): Promise<void> {
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
    }
}
