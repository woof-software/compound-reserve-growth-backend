import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757580580561 implements MigrationInterface {
    name = 'Migration1757580580561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ADD "cap" numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "avgRatio" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "minRatio" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "maxRatio" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "avgPrice" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "minPrice" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "maxPrice" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "oracle_snapshots" ALTER COLUMN "price" TYPE numeric(78,0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "oracle_snapshots" ALTER COLUMN "price" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "maxPrice" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "minPrice" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "avgPrice" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "maxRatio" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "minRatio" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ALTER COLUMN "avgRatio" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" DROP COLUMN "cap"`);
    }

}
