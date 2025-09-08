import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757053841726 implements MigrationInterface {
    name = 'Migration1757053841726'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ADD "sourceId" integer`);
        await queryRunner.query(`ALTER TABLE "oracle_snapshots" ALTER COLUMN "price" TYPE numeric(78,8)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" ADD CONSTRAINT "FK_f21da8fcdb54aaf6071098568f0" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "daily_aggregation" DROP CONSTRAINT "FK_f21da8fcdb54aaf6071098568f0"`);
        await queryRunner.query(`ALTER TABLE "oracle_snapshots" ALTER COLUMN "price" TYPE numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "daily_aggregation" DROP COLUMN "sourceId"`);
    }

}
