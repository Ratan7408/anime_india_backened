import { StandardCheckoutClient, Env } from "pg-sdk-node";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple locations for .env file (same as index.ts)
const possiblePaths = [
  join(__dirname, '..', '.env'),              // backend/.env (from config/)
  join(__dirname, '..', '..', '.env'),       // backend/.env (from config/server/)
  join(__dirname, '.env'),                    // config/.env
  join(process.cwd(), '.env'),                // backend/.env (from current working directory)
  join(process.cwd(), 'server', '.env'),       // backend/server/.env (from current working directory)
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    envLoaded = true;
    break;
  }
}

// Final fallback to default location
if (!envLoaded) {
  dotenv.config();
}

const clientId = process.env.PHONEPE_CLIENT_ID;
const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
const clientVersion = parseInt(process.env.PHONEPE_CLIENT_VERSION || "2"); 
const env = process.env.PHONEPE_ENVIRONMENT === "PROD" ? Env.PRODUCTION : Env.SANDBOX;

if (!clientId || !clientSecret) {
  console.error('❌ PhonePe Config Error:');
  console.error('   PHONEPE_CLIENT_ID:', clientId ? '✅ Set' : '❌ Missing');
  console.error('   PHONEPE_CLIENT_SECRET:', clientSecret ? '✅ Set' : '❌ Missing');
  console.error('   PHONEPE_ENVIRONMENT:', process.env.PHONEPE_ENVIRONMENT || 'Not set (defaulting to SANDBOX)');
  throw new Error("❌ Missing PhonePe credentials. Check .env file.");
}

// Log configuration (without exposing secret)
console.log('📱 PhonePe Configuration:');
console.log('   CLIENT_ID:', clientId ? `${clientId.substring(0, 8)}...` : '❌ Missing');
console.log('   CLIENT_SECRET:', clientSecret ? '✅ Set (hidden)' : '❌ Missing');
console.log('   CLIENT_VERSION:', clientVersion);
console.log('   ENVIRONMENT:', env === Env.PRODUCTION ? 'PRODUCTION' : 'SANDBOX');
console.log('   PHONEPE_ENVIRONMENT env:', process.env.PHONEPE_ENVIRONMENT || 'Not set (defaulting to SANDBOX)');

export const phonepeClient = StandardCheckoutClient.getInstance(
  clientId,
  clientSecret,
  clientVersion,
  env
);
