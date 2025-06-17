export type TDatabaseConfig = {
  environment: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
};

export default (): { database: TDatabaseConfig } => ({
  database: {
    environment: process.env.NODE_ENV,
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
});
