import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server folder
// nodemailer.js is in server/config/, so going up one level (..) gives us server/
const serverEnvPath = join(__dirname, '..', '.env');
console.log('📧 Loading .env from server folder:', serverEnvPath);

const result = dotenv.config({ path: serverEnvPath });
if (result.error) {
  console.error('❌ Error loading .env from server folder:', result.error);
  console.error('   Trying fallback locations...');
  // Try root folder as fallback
  const rootEnvPath = join(__dirname, '..', '..', '.env');
  dotenv.config({ path: rootEnvPath });
  // Also try default location
  dotenv.config();
} else {
  console.log('✅ .env loaded successfully from server folder');
  console.log('   Path:', serverEnvPath);
}

console.log('📧 Nodemailer config loaded');
console.log('📧 SMTP_USER:', process.env.SMTP_USER ? `✅ Set (${process.env.SMTP_USER})` : '❌ Missing');
console.log('📧 SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✅ Set' : '❌ Missing');

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

export default transporter;