import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../data/rants.json');

let cachedDb = null;
let writeQueue = Promise.resolve();

// Ensure the data directory exists
async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

export async function initDb() {
  if (cachedDb) return cachedDb;
  
  try {
    await ensureDir(DB_FILE);
    const data = await fs.readFile(DB_FILE, 'utf-8');
    cachedDb = JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, initialize default structures
    cachedDb = {
      rants: {}, // matchId -> playerId -> { totalRants, rants, playerName, playerPhoto, teamId, teamName, teamCrest }
      totals: {
        players: {}, // playerId -> { totalRants, name, photo, teamId, teamName }
        teams: {},   // teamId -> { totalRants, name, crest }
      }
    };
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(cachedDb, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error("Failed to initialize database file:", writeErr);
    }
  }
  return cachedDb;
}

export async function getDb() {
  if (!cachedDb) {
    await initDb();
  }
  return cachedDb;
}

async function saveDb() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(cachedDb, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to save database to disk:", error);
  }
}

export async function addRant({ matchId, playerId, playerName, playerPhoto, teamId, teamName, teamCrest, rantKey, userId }) {
  // Ensure DB is loaded in memory
  await getDb();

  // 1. Update Match-specific rants in memory cache
  if (!cachedDb.rants[matchId]) {
    cachedDb.rants[matchId] = {};
  }
  if (!cachedDb.rants[matchId][playerId]) {
    cachedDb.rants[matchId][playerId] = {
      totalRants: 0,
      rants: {},
      playerName: playerName || '',
      playerPhoto: playerPhoto || '',
      teamId: teamId || '',
      teamName: teamName || '',
      teamCrest: teamCrest || ''
    };
  }

  const playerMatchData = cachedDb.rants[matchId][playerId];
  playerMatchData.rants[rantKey] = (playerMatchData.rants[rantKey] || 0) + 1;
  playerMatchData.totalRants += 1;
  if (playerName) playerMatchData.playerName = playerName;
  if (playerPhoto) playerMatchData.playerPhoto = playerPhoto;
  if (teamId) playerMatchData.teamId = teamId;
  if (teamName) playerMatchData.teamName = teamName;
  if (teamCrest) playerMatchData.teamCrest = teamCrest;

  // 2. Update global tournament totals for Player in memory cache
  if (!cachedDb.totals.players[playerId]) {
    cachedDb.totals.players[playerId] = {
      totalRants: 0,
      name: playerName || '',
      photo: playerPhoto || '',
      teamId: teamId || '',
      teamName: teamName || ''
    };
  }
  cachedDb.totals.players[playerId].totalRants += 1;
  if (playerName) cachedDb.totals.players[playerId].name = playerName;
  if (playerPhoto) cachedDb.totals.players[playerId].photo = playerPhoto;
  if (teamId) cachedDb.totals.players[playerId].teamId = teamId;
  if (teamName) cachedDb.totals.players[playerId].teamName = teamName;

  // 3. Update global tournament totals for Team in memory cache
  if (teamId) {
    if (!cachedDb.totals.teams[teamId]) {
      cachedDb.totals.teams[teamId] = {
        totalRants: 0,
        name: teamName || '',
        crest: teamCrest || ''
      };
    }
    cachedDb.totals.teams[teamId].totalRants += 1;
    if (teamName) cachedDb.totals.teams[teamId].name = teamName;
    if (teamCrest) cachedDb.totals.teams[teamId].crest = teamCrest;
  }

  // 4. Asynchronously queue writing the updated memory cache to JSON disk
  writeQueue = writeQueue.then(() => saveDb());

  return playerMatchData;
}
