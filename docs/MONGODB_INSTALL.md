# MongoDB Installation Documentation

## Requirements
- MongoDB (local) required. App uses MongoDB (replica set `rs0` mentioned in project context).
- Connection via `MONGODB_URI` or default (see `src/main/db.ts`)

## Local Setup (Windows)
1. Install MongoDB Community Server
2. Start mongod (optionally as replica set for transactions)
3. Ensure it's accessible on configured URI
4. App will create collections/indexes on startup

## Notes
- If MongoDB unavailable, app shows graceful UI (tested)
- Backup/restore via Settings
- Data stored locally per deployment
