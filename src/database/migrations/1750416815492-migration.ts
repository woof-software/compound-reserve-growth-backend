import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1750416815492 implements MigrationInterface {
    name = 'Migration1750416815492'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset" RENAME COLUMN "chain" TO "network"`);
        await queryRunner.query(`ALTER TABLE "source" ADD "network" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "network"`);
        await queryRunner.query(`ALTER TABLE "asset" RENAME COLUMN "network" TO "chain"`);
    }

}
