export type AdminConfig = {
  token: string | undefined;
};

const adminToken = process.env.ADMIN_TOKEN;

export default (): { admin: AdminConfig } => ({
  admin: {
    token: adminToken,
  },
});
