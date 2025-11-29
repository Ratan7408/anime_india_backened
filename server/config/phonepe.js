import { StandardCheckoutClient, Env } from "pg-sdk-node";
import dotenv from "dotenv";
import path from "path";

// Ensure env loads from server/.env even when started from project root
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });

const clientId = process.env.PHONEPE_CLIENT_ID;
const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
const clientVersion = parseInt(process.env.PHONEPE_CLIENT_VERSION || "2"); 
const env = process.env.PHONEPE_ENVIRONMENT === "PROD" ? Env.PRODUCTION : Env.SANDBOX;

if (!clientId || !clientSecret) {
  throw new Error("❌ Missing PhonePe credentials. Check .env file.");
}

export const phonepeClient = StandardCheckoutClient.getInstance(
  clientId,
  clientSecret,
  clientVersion,
  env
);
