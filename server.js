// JSON Server entry point for local runs and for hosting the API.
// DB_PATH lets the database live on a persistent disk (for example /data/db.json).
import fs from 'node:fs';
import path from 'node:path';
import jsonServer from 'json-server';

const seedPath = path.resolve('db.json');
const dbPath = path.resolve(process.env.DB_PATH || 'db.json');

// First start on a new disk: copy the seed data across.
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.copyFileSync(seedPath, dbPath);
}

const server = jsonServer.create();
const router = jsonServer.router(dbPath);

server.use(jsonServer.defaults()); // CORS, logging, JSON body parsing
server.use(router);                // REST routes generated from the database

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`AssetTrack API running on port ${port} (db: ${dbPath})`);
});
