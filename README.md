# Anime India Backend API

Backend API for Anime India Print-on-Demand platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file in `server/` directory with required environment variables.

3. Build the backend:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

## Environment Variables

Required environment variables should be set in `server/.env`:
- Database connection strings
- SMTP credentials
- JWT secrets
- Payment gateway credentials
- Frontend URL

## Development

Run in development mode:
```bash
npm run dev
```

## Production

The server runs on port 5000 by default. Use PM2 or similar process manager for production:

```bash
pm2 start npm --name anime-backend -- run start
```
