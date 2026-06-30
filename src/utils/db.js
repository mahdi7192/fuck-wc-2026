import Redis from 'ioredis';
import { EventEmitter } from 'events';

globalThis.dbEvents = globalThis.dbEvents || new EventEmitter();

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

// Memory-mode cache fallback
globalThis.cachedDb = globalThis.cachedDb || {
  rants: {},
  totals: {
    players: {},
    teams: {},
  },
  recentRants: {},
  userTotals: {}
};

// Initialize DB and perform migration if legacy monolithic database is present
export async function initDb() {
  if (hasRedis && redisClient) {
    try {
      // 1. Check if legacy monolithic 'rants_db' key exists
      const oldDataStr = await redisClient.get('rants_db');
      if (oldDataStr) {
        console.log("[Migration] Found legacy monolithic 'rants_db' key. Migrating to fine-grained Redis structure...");
        const db = JSON.parse(oldDataStr);
        
        // Migrate match rants
        if (db.rants) {
          for (const [matchId, matchRants] of Object.entries(db.rants)) {
            for (const [playerId, playerRantData] of Object.entries(matchRants)) {
              await redisClient.hset(`match_rants:${matchId}`, playerId, JSON.stringify(playerRantData));
            }
          }
        }
        
        // Migrate player totals
        if (db.totals && db.totals.players) {
          for (const [playerId, playerTotal] of Object.entries(db.totals.players)) {
            await redisClient.hset('totals:players', playerId, JSON.stringify(playerTotal));
          }
        }

        // Migrate team totals
        if (db.totals && db.totals.teams) {
          for (const [teamId, teamTotal] of Object.entries(db.totals.teams)) {
            await redisClient.hset('totals:teams', teamId, JSON.stringify(teamTotal));
          }
        }

        // Migrate recent rants (chat logs)
        if (db.recentRants) {
          for (const [matchId, recentList] of Object.entries(db.recentRants)) {
            if (Array.isArray(recentList) && recentList.length > 0) {
              const msgStrings = recentList.map(msg => JSON.stringify(msg));
              await redisClient.rpush(`recent_rants:${matchId}`, ...msgStrings);
              await redisClient.ltrim(`recent_rants:${matchId}`, -100, -1);
            }
          }
        }

        // Migrate user totals
        if (db.userTotals) {
          for (const [userId, userTotal] of Object.entries(db.userTotals)) {
            await redisClient.hset('totals:users', userId, JSON.stringify(userTotal));
          }
        }

        // Rename the old key so we don't run migration again
        await redisClient.rename('rants_db', 'rants_db:migrated');
        console.log("[Migration] Database migration completed successfully!");
      }

      // 2. Migrate existing user profiles to the new telegram_chat_ids Set
      const migratedKey = 'migration:telegram_chat_ids_populated';
      const alreadyMigrated = await redisClient.get(migratedKey);
      if (!alreadyMigrated) {
        console.log("[Migration] Populating telegram_chat_ids Set from existing user profiles...");
        let cursor = '0';
        const userIds = [];
        do {
          const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'user_profile:*', 'COUNT', 100);
          cursor = nextCursor;
          for (const key of keys) {
            const userId = key.replace('user_profile:', '');
            if (userId) {
              userIds.push(userId);
            }
          }
        } while (cursor !== '0');

        if (userIds.length > 0) {
          // Add them all to the set
          await redisClient.sadd('telegram_chat_ids', ...userIds);
          console.log(`[Migration] Successfully added ${userIds.length} existing user IDs to telegram_chat_ids Set.`);
        }
        await redisClient.set(migratedKey, '1');
      }
    } catch (err) {
      console.error("[Migration] Failed during legacy Redis migration:", err);
    }
  }
}

// Initialize on load
if (typeof window === 'undefined') {
  initDb();
}

// Backward-compatible monolithic getDb method (heavy scanned rebuild, not recommended in production)
export async function getDb() {
  if (!hasRedis) {
    return globalThis.cachedDb;
  }
  
  // Reconstruct monolithic DB structure for compatibility
  const db = {
    rants: {},
    totals: {
      players: {},
      teams: {},
    },
    recentRants: {},
    userTotals: {}
  };
  
  try {
    // Reconstruct match rants
    const matchRantsKeys = await redisClient.keys('match_rants:*');
    for (const key of matchRantsKeys) {
      const matchId = key.replace('match_rants:', '');
      const raw = await redisClient.hgetall(key);
      db.rants[matchId] = {};
      for (const [playerId, val] of Object.entries(raw)) {
        db.rants[matchId][playerId] = JSON.parse(val);
      }
    }
    
    // Reconstruct totals players
    const rawPlayers = await redisClient.hgetall('totals:players');
    for (const [playerId, val] of Object.entries(rawPlayers)) {
      db.totals.players[playerId] = JSON.parse(val);
    }
    
    // Reconstruct totals teams
    const rawTeams = await redisClient.hgetall('totals:teams');
    for (const [teamId, val] of Object.entries(rawTeams)) {
      db.totals.teams[teamId] = JSON.parse(val);
    }

    // Reconstruct recent rants
    const recentKeys = await redisClient.keys('recent_rants:*');
    for (const key of recentKeys) {
      const matchId = key.replace('recent_rants:', '');
      const rawList = await redisClient.lrange(key, 0, -1);
      db.recentRants[matchId] = rawList.map(val => JSON.parse(val));
    }

    // Reconstruct user totals
    const rawUsers = await redisClient.hgetall('totals:users');
    for (const [userId, val] of Object.entries(rawUsers)) {
      db.userTotals[userId] = JSON.parse(val);
    }
  } catch (error) {
    console.error("Failed to reconstruct monolithic DB:", error);
  }
  
  return db;
}

// 1. Fetch match-specific player rants
export async function getMatchRants(matchId) {
  if (!hasRedis || !redisClient) {
    return globalThis.cachedDb.rants[matchId] || {};
  }
  
  try {
    const raw = await redisClient.hgetall(`match_rants:${matchId}`);
    const rants = {};
    for (const [playerId, val] of Object.entries(raw)) {
      rants[playerId] = JSON.parse(val);
    }
    return rants;
  } catch (error) {
    console.error(`Failed to getMatchRants for match: ${matchId}`, error);
    return {};
  }
}

// 2. Fetch recent rants (chat messages) for a match
export async function getRecentRants(matchId, since = 0) {
  if (!hasRedis || !redisClient) {
    const recent = globalThis.cachedDb.recentRants[matchId] || [];
    return recent.filter(r => r.timestamp > since);
  }
  
  try {
    const rawList = await redisClient.lrange(`recent_rants:${matchId}`, 0, -1);
    const parsed = rawList.map(val => JSON.parse(val));
    return parsed.filter(r => r.timestamp > since);
  } catch (error) {
    console.error(`Failed to getRecentRants for match: ${matchId}`, error);
    return [];
  }
}

// 3. Register a new rant/chat message dynamically and atomically
export async function addRant({ matchId, playerId, playerName, playerPhoto, teamId, teamName, teamCrest, rantKey, userId, userName, userAvatar }) {
  const now = Date.now();
  const rantId = `${now}_${Math.random().toString(36).substr(2, 9)}`;

  // Memory mode (RAM Fallback)
  if (!hasRedis || !redisClient) {
    let playerMatchData = null;

    if (playerId) {
      if (!globalThis.cachedDb.rants[matchId]) {
        globalThis.cachedDb.rants[matchId] = {};
      }
      if (!globalThis.cachedDb.rants[matchId][playerId]) {
        globalThis.cachedDb.rants[matchId][playerId] = {
          totalRants: 0,
          rants: {},
          playerName: playerName || '',
          playerPhoto: playerPhoto || '',
          teamId: teamId || '',
          teamName: teamName || '',
          teamCrest: teamCrest || ''
        };
      }

      playerMatchData = globalThis.cachedDb.rants[matchId][playerId];
      playerMatchData.rants[rantKey] = (playerMatchData.rants[rantKey] || 0) + 1;
      playerMatchData.totalRants += 1;
      if (playerName) playerMatchData.playerName = playerName;
      if (playerPhoto) playerMatchData.playerPhoto = playerPhoto;
      if (teamId) playerMatchData.teamId = teamId;
      if (teamName) playerMatchData.teamName = teamName;
      if (teamCrest) playerMatchData.teamCrest = teamCrest;

      if (!globalThis.cachedDb.totals.players[playerId]) {
        globalThis.cachedDb.totals.players[playerId] = {
          totalRants: 0,
          name: playerName || '',
          photo: playerPhoto || '',
          teamId: teamId || '',
          teamName: teamName || ''
        };
      }
      globalThis.cachedDb.totals.players[playerId].totalRants += 1;

      if (teamId) {
        if (!globalThis.cachedDb.totals.teams[teamId]) {
          globalThis.cachedDb.totals.teams[teamId] = {
            totalRants: 0,
            name: teamName || '',
            crest: teamCrest || ''
          };
        }
        globalThis.cachedDb.totals.teams[teamId].totalRants += 1;
      }
    }

    const message = {
      id: rantId,
      playerId: playerId || null,
      playerName: playerName || '',
      rantKey,
      userId,
      userName: userName || 'تماشاگر ناشناس',
      userAvatar: userAvatar || '',
      timestamp: now
    };

    if (!globalThis.cachedDb.recentRants[matchId]) {
      globalThis.cachedDb.recentRants[matchId] = [];
    }
    globalThis.cachedDb.recentRants[matchId].push(message);
    if (globalThis.cachedDb.recentRants[matchId].length > 50) {
      globalThis.cachedDb.recentRants[matchId] = globalThis.cachedDb.recentRants[matchId].slice(-50);
    }

    if (userId) {
      if (!globalThis.cachedDb.userTotals) globalThis.cachedDb.userTotals = {};
      if (!globalThis.cachedDb.userTotals[userId]) {
        globalThis.cachedDb.userTotals[userId] = {
          totalRants: 0,
          name: userName || 'تماشاگر ناشناس',
          avatar: userAvatar || ''
        };
      }
      globalThis.cachedDb.userTotals[userId].totalRants += 1;

      // Save user rants per match in memory
      if (!globalThis.cachedDb.userMatchTotals) {
        globalThis.cachedDb.userMatchTotals = {};
      }
      if (!globalThis.cachedDb.userMatchTotals[matchId]) {
        globalThis.cachedDb.userMatchTotals[matchId] = {};
      }
      if (!globalThis.cachedDb.userMatchTotals[matchId][userId]) {
        globalThis.cachedDb.userMatchTotals[matchId][userId] = {
          totalRants: 0,
          name: userName || 'تماشاگر ناشناس',
          avatar: userAvatar || ''
        };
      }
      globalThis.cachedDb.userMatchTotals[matchId][userId].totalRants += 1;
    }

    // Emit event locally for SSE stream
    if (globalThis.dbEvents) {
      globalThis.dbEvents.emit(`match_channel:${matchId}`, message);
    }

    return playerId ? playerMatchData : { success: true };
  }

  // Redis mode (Atomic operations)
  try {
    let playerMatchData = null;

    if (playerId) {
      // 1. Update Match-specific rants
      const rawPlayerMatch = await redisClient.hget(`match_rants:${matchId}`, playerId);
      let data = rawPlayerMatch ? JSON.parse(rawPlayerMatch) : {
        totalRants: 0,
        rants: {},
        playerName: playerName || '',
        playerPhoto: playerPhoto || '',
        teamId: teamId || '',
        teamName: teamName || '',
        teamCrest: teamCrest || ''
      };
      data.totalRants += 1;
      data.rants[rantKey] = (data.rants[rantKey] || 0) + 1;
      if (playerName) data.playerName = playerName;
      if (playerPhoto) data.playerPhoto = playerPhoto;
      if (teamId) data.teamId = teamId;
      if (teamName) data.teamName = teamName;
      if (teamCrest) data.teamCrest = teamCrest;

      playerMatchData = data;
      await redisClient.hset(`match_rants:${matchId}`, playerId, JSON.stringify(data));

      // 2. Update global tournament totals for Player
      const rawPlayerTotal = await redisClient.hget('totals:players', playerId);
      let pTotal = rawPlayerTotal ? JSON.parse(rawPlayerTotal) : {
        totalRants: 0,
        name: playerName || '',
        photo: playerPhoto || '',
        teamId: teamId || '',
        teamName: teamName || ''
      };
      pTotal.totalRants += 1;
      if (playerName) pTotal.name = playerName;
      if (playerPhoto) pTotal.photo = playerPhoto;
      if (teamId) pTotal.teamId = teamId;
      if (teamName) pTotal.teamName = teamName;
      await redisClient.hset('totals:players', playerId, JSON.stringify(pTotal));

      // 3. Update global tournament totals for Team
      if (teamId) {
        const rawTeamTotal = await redisClient.hget('totals:teams', teamId);
        let tTotal = rawTeamTotal ? JSON.parse(rawTeamTotal) : {
          totalRants: 0,
          name: teamName || '',
          crest: teamCrest || ''
        };
        tTotal.totalRants += 1;
        if (teamName) tTotal.name = teamName;
        if (teamCrest) tTotal.crest = teamCrest;
        await redisClient.hset('totals:teams', teamId, JSON.stringify(tTotal));
      }
    }

    // 4. Update recent rants log (chat list)
    const message = {
      id: rantId,
      playerId: playerId || null,
      playerName: playerName || '',
      rantKey,
      userId,
      userName: userName || 'تماشاگر ناشناس',
      userAvatar: userAvatar || '',
      timestamp: now
    };
    const messageStr = JSON.stringify(message);
    await redisClient.rpush(`recent_rants:${matchId}`, messageStr);
    await redisClient.ltrim(`recent_rants:${matchId}`, -100, -1);

    // 5. Update global user totals
    if (userId) {
      const rawUserTotal = await redisClient.hget('totals:users', userId);
      let uTotal = rawUserTotal ? JSON.parse(rawUserTotal) : {
        totalRants: 0,
        name: userName || 'تماشاگر ناشناس',
        avatar: userAvatar || ''
      };
      uTotal.totalRants += 1;
      if (userName) uTotal.name = userName;
      if (userAvatar) uTotal.avatar = userAvatar;
      await redisClient.hset('totals:users', userId, JSON.stringify(uTotal));

      // Save user rants per match in Redis
      const rawUserMatchTotal = await redisClient.hget(`user_rants:${matchId}`, userId);
      let umTotal = rawUserMatchTotal ? JSON.parse(rawUserMatchTotal) : {
        totalRants: 0,
        name: userName || 'تماشاگر ناشناس',
        avatar: userAvatar || ''
      };
      umTotal.totalRants += 1;
      if (userName) umTotal.name = userName;
      if (userAvatar) umTotal.avatar = userAvatar;
      await redisClient.hset(`user_rants:${matchId}`, userId, JSON.stringify(umTotal));
    }

    // Publish to Redis Pub/Sub channel and emit locally for SSE
    await redisClient.publish(`match_channel:${matchId}`, messageStr);
    if (globalThis.dbEvents) {
      globalThis.dbEvents.emit(`match_channel:${matchId}`, message);
    }

    return playerId ? playerMatchData : { success: true };
  } catch (error) {
    console.error("Failed to add rant to Redis:", error);
    return playerId ? { totalRants: 0, rants: {} } : { success: false };
  }
}

export async function saveMatchDate(matchId, utcDate) {
  if (!matchId || !utcDate || matchId === 'simulated-match') return;
  if (hasRedis && redisClient) {
    try {
      await redisClient.hset('match_dates', matchId, utcDate);
    } catch (e) {
      console.error("Error saving match date to Redis:", e);
    }
  } else {
    if (!globalThis.cachedDb.matchDates) globalThis.cachedDb.matchDates = {};
    globalThis.cachedDb.matchDates[matchId] = utcDate;
  }
}

export async function getMatchDate(matchId) {
  if (matchId === 'simulated-match') {
    return new Date().toISOString();
  }

  if (hasRedis && redisClient) {
    try {
      const date = await redisClient.hget('match_dates', matchId);
      if (date) return date;
    } catch (e) {
      console.error("Error reading match date from Redis:", e);
    }
  } else {
    if (globalThis.cachedDb.matchDates && globalThis.cachedDb.matchDates[matchId]) {
      return globalThis.cachedDb.matchDates[matchId];
    }
  }

  // Fallback: fetch from ESPN API
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${matchId}`);
    if (res.ok) {
      const data = await res.json();
      const utcDate = data?.header?.competitions?.[0]?.date;
      if (utcDate) {
        await saveMatchDate(matchId, utcDate);
        return utcDate;
      }
    }
  } catch (e) {
    console.error(`Error fetching match date for ${matchId} from ESPN:`, e);
  }

  return null;
}

// 4. Fetch leaderboard metrics
export async function getLeaderboard() {
  const CUTOFF_DATE = new Date('2026-06-28T00:00:00Z');

  const playerAgg = {}; // playerId -> { id, name, photo, teamId, teamName, totalRants }
  const teamAgg = {};   // teamId -> { id, name, crest, totalRants }
  const userAgg = {};   // userId -> { id, name, avatar, totalRants }

  // 1. Get all match IDs that have rants
  let matchIds = [];
  if (hasRedis && redisClient) {
    try {
      const keys = await redisClient.keys('match_rants:*');
      matchIds = keys.map(k => k.replace('match_rants:', ''));
    } catch (e) {
      console.error("Error fetching match rants keys from Redis:", e);
    }
  } else {
    matchIds = Object.keys(globalThis.cachedDb.rants || {});
  }

  // Filter matchIds to only keep matches >= CUTOFF_DATE and not test matches
  const validMatchIds = [];
  for (const matchId of matchIds) {
    if (matchId === 'simulated-match') continue;

    const matchDateStr = await getMatchDate(matchId);
    if (!matchDateStr) {
      console.warn(`Could not determine date for match: ${matchId}, skipping.`);
      continue;
    }

    const mDate = new Date(matchDateStr);
    if (mDate >= CUTOFF_DATE) {
      validMatchIds.push(matchId);
    }
  }

  // 2. Aggregate player and team rants
  for (const matchId of validMatchIds) {
    let rants = {};
    if (hasRedis && redisClient) {
      try {
        const raw = await redisClient.hgetall(`match_rants:${matchId}`);
        for (const [playerId, val] of Object.entries(raw)) {
          rants[playerId] = JSON.parse(val);
        }
      } catch (e) {
        console.error(`Error reading match rants for ${matchId}:`, e);
      }
    } else {
      rants = globalThis.cachedDb.rants[matchId] || {};
    }

    for (const [playerId, data] of Object.entries(rants)) {
      if (!playerId) continue;
      // Aggregate Player
      if (!playerAgg[playerId]) {
        playerAgg[playerId] = {
          id: playerId,
          name: data.playerName || '',
          photo: data.playerPhoto || '',
          teamId: data.teamId || '',
          teamName: data.teamName || '',
          totalRants: 0
        };
      }
      playerAgg[playerId].totalRants += data.totalRants || 0;

      // Aggregate Team
      if (data.teamId) {
        if (!teamAgg[data.teamId]) {
          teamAgg[data.teamId] = {
            id: data.teamId,
            name: data.teamName || '',
            crest: data.teamCrest || '',
            totalRants: 0
          };
        }
        teamAgg[data.teamId].totalRants += data.totalRants || 0;
      }
    }
  }

  // 3. Aggregate user rants
  for (const matchId of validMatchIds) {
    let userRants = {};
    if (hasRedis && redisClient) {
      try {
        const raw = await redisClient.hgetall(`user_rants:${matchId}`);
        if (raw && Object.keys(raw).length > 0) {
          for (const [userId, val] of Object.entries(raw)) {
            userRants[userId] = JSON.parse(val);
          }
        } else {
          // Fallback: reconstruct from recent_rants:${matchId}
          const rawList = await redisClient.lrange(`recent_rants:${matchId}`, 0, -1);
          const messages = rawList.map(val => JSON.parse(val));
          for (const msg of messages) {
            if (msg.userId) {
              if (!userRants[msg.userId]) {
                userRants[msg.userId] = {
                  id: msg.userId,
                  name: msg.userName || 'تماشاگر ناشناس',
                  avatar: msg.userAvatar || '',
                  totalRants: 0
                };
              }
              userRants[msg.userId].totalRants += 1;
            }
          }
        }
      } catch (e) {
        console.error(`Error reading user rants for ${matchId}:`, e);
      }
    } else {
      if (globalThis.cachedDb.userMatchTotals && globalThis.cachedDb.userMatchTotals[matchId]) {
        userRants = globalThis.cachedDb.userMatchTotals[matchId];
      } else {
        // Reconstruct from recentRants
        const messages = globalThis.cachedDb.recentRants[matchId] || [];
        for (const msg of messages) {
          if (msg.userId) {
            if (!userRants[msg.userId]) {
              userRants[msg.userId] = {
                id: msg.userId,
                name: msg.userName || 'تماشاگر ناشناس',
                avatar: msg.userAvatar || '',
                totalRants: 0
              };
            }
            userRants[msg.userId].totalRants += 1;
          }
        }
      }
    }

    for (const [userId, data] of Object.entries(userRants)) {
      if (!userId) continue;
      if (!userAgg[userId]) {
        userAgg[userId] = {
          id: userId,
          name: data.name || '',
          avatar: data.avatar || '',
          totalRants: 0
        };
      }
      userAgg[userId].totalRants += data.totalRants || 0;
    }
  }

  // Sort and limit to top 10
  const topPlayers = Object.values(playerAgg)
    .sort((a, b) => b.totalRants - a.totalRants)
    .slice(0, 10);

  const topTeams = Object.values(teamAgg)
    .sort((a, b) => b.totalRants - a.totalRants)
    .slice(0, 10);

  const topUsers = Object.values(userAgg)
    .sort((a, b) => b.totalRants - a.totalRants)
    .slice(0, 10);

  return { players: topPlayers, teams: topTeams, users: topUsers };
}

// 5. User profile and predictions (unchanged API, key-isolated)
export async function getUserProfile(userId) {
  if (hasRedis && redisClient) {
    try {
      const data = await redisClient.get(`user_profile:${userId}`);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Failed to get user profile from Redis:", e);
    }
  }
  if (!globalThis.userProfiles) globalThis.userProfiles = {};
  return globalThis.userProfiles[userId] || null;
}

export async function setUserProfile(userId, profile) {
  if (hasRedis && redisClient) {
    try {
      if (profile === null) {
        await redisClient.del(`user_profile:${userId}`);
      } else {
        await redisClient.set(`user_profile:${userId}`, JSON.stringify(profile));
      }
    } catch (e) {
      console.error("Failed to set user profile in Redis:", e);
    }
  }
  if (!globalThis.userProfiles) globalThis.userProfiles = {};
  if (profile === null) {
    delete globalThis.userProfiles[userId];
  } else {
    globalThis.userProfiles[userId] = profile;
  }
}

export async function getPrediction(userId, matchId) {
  if (hasRedis && redisClient) {
    try {
      const p = await redisClient.get(`user_pred:${userId}:${matchId}`);
      if (p) return p;
    } catch (e) {
      console.error("Failed to get prediction from Redis:", e);
    }
  }
  if (!globalThis.userPredictions) globalThis.userPredictions = {};
  return globalThis.userPredictions[`${userId}:${matchId}`] || null;
}

export async function setPrediction(userId, matchId, playerId) {
  if (hasRedis && redisClient) {
    try {
      if (playerId === null) {
        await redisClient.del(`user_pred:${userId}:${matchId}`);
      } else {
        await redisClient.set(`user_pred:${userId}:${matchId}`, playerId);
      }
    } catch (e) {
      console.error("Failed to set prediction in Redis:", e);
    }
  }
  if (!globalThis.userPredictions) globalThis.userPredictions = {};
  if (playerId === null) {
    delete globalThis.userPredictions[`${userId}:${matchId}`];
  } else {
    globalThis.userPredictions[`${userId}:${matchId}`] = playerId;
  }
}

export async function saveTelegramChatId(chatId) {
  if (!chatId) return;
  const idStr = chatId.toString();
  if (hasRedis && redisClient) {
    try {
      await redisClient.sadd('telegram_chat_ids', idStr);
    } catch (e) {
      console.error("Failed to save telegram chat ID in Redis:", e);
    }
  }
  if (!globalThis.telegramChatIds) globalThis.telegramChatIds = new Set();
  globalThis.telegramChatIds.add(idStr);
}

export async function getTelegramChatIds() {
  if (hasRedis && redisClient) {
    try {
      const ids = await redisClient.smembers('telegram_chat_ids');
      return ids || [];
    } catch (e) {
      console.error("Failed to get telegram chat IDs from Redis:", e);
      return [];
    }
  }
  if (!globalThis.telegramChatIds) globalThis.telegramChatIds = new Set();
  return Array.from(globalThis.telegramChatIds);
}
