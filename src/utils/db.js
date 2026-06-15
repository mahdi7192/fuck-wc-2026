import Redis from 'ioredis';

const redisUrl = (typeof process !== 'undefined' && process.env?.REDIS_URL) || 
                 (typeof import.meta !== 'undefined' && import.meta.env?.REDIS_URL);

const hasRedis = !!redisUrl;

let redisClient = null;
if (hasRedis) {
  try {
    redisClient = new Redis(redisUrl);
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  } catch (err) {
    console.error('Failed to create Redis client instance:', err);
  }
}

let cachedDb = null;

export async function initDb() {
  if (hasRedis && redisClient) {
    try {
      const data = await redisClient.get('rants_db');
      if (data) {
        cachedDb = JSON.parse(data);
        if (!cachedDb.recentRants) {
          cachedDb.recentRants = {};
        }
      } else {
        cachedDb = {
          rants: {},
          totals: {
            players: {},
            teams: {},
          },
          recentRants: {}
        };
        await redisClient.set('rants_db', JSON.stringify(cachedDb));
      }
    } catch (error) {
      console.error("Failed to initialize database from Redis:", error);
      if (!cachedDb) {
        cachedDb = {
          rants: {},
          totals: {
            players: {},
            teams: {},
          },
          recentRants: {}
        };
      }
    }
  } else {
    // RAM mode
    if (!cachedDb) {
      cachedDb = {
        rants: {},
        totals: {
          players: {},
          teams: {},
        },
        recentRants: {}
      };
    } else if (!cachedDb.recentRants) {
      cachedDb.recentRants = {};
    }
  }
  return cachedDb;
}

export async function getDb() {
  if (hasRedis && redisClient) {
    try {
      const data = await redisClient.get('rants_db');
      if (data) {
        cachedDb = JSON.parse(data);
        if (!cachedDb.recentRants) {
          cachedDb.recentRants = {};
        }
        return cachedDb;
      }
    } catch (error) {
      console.error("Failed to get database from Redis:", error);
    }
  }
  
  if (!cachedDb) {
    await initDb();
  } else if (!cachedDb.recentRants) {
    cachedDb.recentRants = {};
  }
  return cachedDb;
}

async function saveDb() {
  if (hasRedis && redisClient) {
    try {
      await redisClient.set('rants_db', JSON.stringify(cachedDb));
    } catch (error) {
      console.error("Failed to save database to Redis:", error);
    }
  }
  // For RAM mode, it's already updated in memory since it's a reference
}

export async function addRant({ matchId, playerId, playerName, playerPhoto, teamId, teamName, teamCrest, rantKey, userId }) {
  const db = await getDb();

  // 1. Update Match-specific rants
  if (!db.rants[matchId]) {
    db.rants[matchId] = {};
  }
  if (!db.rants[matchId][playerId]) {
    db.rants[matchId][playerId] = {
      totalRants: 0,
      rants: {},
      playerName: playerName || '',
      playerPhoto: playerPhoto || '',
      teamId: teamId || '',
      teamName: teamName || '',
      teamCrest: teamCrest || ''
    };
  }

  const playerMatchData = db.rants[matchId][playerId];
  playerMatchData.rants[rantKey] = (playerMatchData.rants[rantKey] || 0) + 1;
  playerMatchData.totalRants += 1;
  if (playerName) playerMatchData.playerName = playerName;
  if (playerPhoto) playerMatchData.playerPhoto = playerPhoto;
  if (teamId) playerMatchData.teamId = teamId;
  if (teamName) playerMatchData.teamName = teamName;
  if (teamCrest) playerMatchData.teamCrest = teamCrest;

  // 2. Update global tournament totals for Player
  if (!db.totals.players[playerId]) {
    db.totals.players[playerId] = {
      totalRants: 0,
      name: playerName || '',
      photo: playerPhoto || '',
      teamId: teamId || '',
      teamName: teamName || ''
    };
  }
  db.totals.players[playerId].totalRants += 1;
  if (playerName) db.totals.players[playerId].name = playerName;
  if (playerPhoto) db.totals.players[playerId].photo = playerPhoto;
  if (teamId) db.totals.players[playerId].teamId = teamId;
  if (teamName) db.totals.players[playerId].teamName = teamName;

  // 3. Update global tournament totals for Team
  if (teamId) {
    if (!db.totals.teams[teamId]) {
      db.totals.teams[teamId] = {
        totalRants: 0,
        name: teamName || '',
        crest: teamCrest || ''
      };
    }
    db.totals.teams[teamId].totalRants += 1;
    if (teamName) db.totals.teams[teamId].name = teamName;
    if (teamCrest) db.totals.teams[teamId].crest = teamCrest;
  }

  // 3.5. Update recent rants log
  if (!db.recentRants) {
    db.recentRants = {};
  }
  if (!db.recentRants[matchId]) {
    db.recentRants[matchId] = [];
  }
  db.recentRants[matchId].push({
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    rantKey,
    timestamp: Date.now()
  });
  if (db.recentRants[matchId].length > 50) {
    db.recentRants[matchId] = db.recentRants[matchId].slice(-50);
  }

  // 4. Save to persistent storage
  cachedDb = db;
  await saveDb();

  return playerMatchData;
}
