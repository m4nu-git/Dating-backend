import dotenv from "dotenv";

dotenv.config();

export const serverConfig = {
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || "",
  AWS_REGION: process.env.AWS_REGION || "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_BUCKET: process.env.AWS_BUCKET || "",
  BLOOM_FILTER_SIZE: Number(process.env.BLOOM_FILTER_SIZE) || 28755175,
  HASH_SIZE: Number(process.env.HASH_SIZE) || 10,
};
