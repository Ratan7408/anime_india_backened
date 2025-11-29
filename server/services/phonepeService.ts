import dotenv from "dotenv";
import path from "path";
import { StandardCheckoutClient, Env } from "pg-sdk-node";

// Ensure env loads from server/.env even when starting from project root
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });

const CLIENT_ID = process.env.PHONEPE_CLIENT_ID as string;
const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET as string;
const CLIENT_VERSION = parseInt(process.env.PHONEPE_CLIENT_VERSION || "1", 10);
const ENVIRONMENT = process.env.PHONEPE_ENVIRONMENT === "PROD" ? Env.PRODUCTION : Env.SANDBOX;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ PhonePe credentials missing", { CLIENT_ID: !!CLIENT_ID, CLIENT_SECRET: !!CLIENT_SECRET });
  throw new Error("Missing PhonePe credentials");
}

export const phonepeClient = StandardCheckoutClient.getInstance(
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_VERSION,
  ENVIRONMENT
);

export default phonepeClient;
