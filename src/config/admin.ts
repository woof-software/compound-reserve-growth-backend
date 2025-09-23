export type AdminConfig = {
  token: string;
};

const adminToken = process.env.ADMIN_TOKEN;
if (!adminToken) throw new Error(`Missing env: ADMIN_TOKEN`);

export default (): { admin: AdminConfig } => ({
  admin: {
    token: adminToken,
  },
});
