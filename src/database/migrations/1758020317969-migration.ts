import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1758020317969 implements MigrationInterface {
  name = 'Migration1758020317969';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "liquidation_event" ("id" SERIAL NOT NULL, "blockNumber" integer NOT NULL, "txHash" character varying NOT NULL, "liquidator" character varying NOT NULL, "tokenAddress" character varying NOT NULL, "priceFeed" character varying, "earnings" character varying NOT NULL, "date" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sourceId" integer, CONSTRAINT "PK_b81c20a3c0b565ceaf4491d66c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "liquidation_event" ADD CONSTRAINT "FK_4812a31b0f11331ce99e2cfeb28" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "liquidation_event" DROP CONSTRAINT "FK_4812a31b0f11331ce99e2cfeb28"`,
    );
    await queryRunner.query(`DROP TABLE "liquidation_event"`);
  }
}
