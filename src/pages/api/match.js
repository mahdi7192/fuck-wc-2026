export const prerender = false;
import { getDb, addRant } from '../../utils/db.js';
import { broadcastToMatch } from './live.js';

// Initialize global variables to store cache in RAM
globalThis.matchCache = globalThis.matchCache || { matches: null, details: {} };


const logDebug = (msg, obj = '') => {
  // Debug logging disabled
};

const getCache = () => {
  return globalThis.matchCache;
};

const saveCache = (cacheData) => {
  globalThis.matchCache = cacheData;
  logDebug("Cache saved in RAM successfully.");
};

const mapPosition = (posAbbr, posName) => {
  const cleanAbbr = posAbbr?.toUpperCase() || '';
  const cleanName = posName?.toUpperCase() || '';
  
  if (cleanAbbr === 'G' || cleanName.includes('GOALKEEPER')) return 'GOALKEEPER';
  if (cleanAbbr === 'LB' || cleanAbbr === 'RB' || cleanAbbr === 'CB' || cleanAbbr.includes('DF') || cleanName.includes('DEFENDER') || cleanName.includes('BACK')) return 'DEFENDER';
  if (cleanAbbr === 'LM' || cleanAbbr === 'RM' || cleanAbbr === 'CM' || cleanAbbr === 'AM' || cleanAbbr === 'DM' || cleanAbbr.includes('MID') || cleanName.includes('MIDFIELDER')) return 'MIDFIELDER';
  if (cleanAbbr === 'F' || cleanAbbr === 'ST' || cleanAbbr === 'FW' || cleanName.includes('FORWARD') || cleanName.includes('STRIKER') || cleanName.includes('WINGER')) return 'FORWARD';
  
  return 'MIDFIELDER';
};

const parseDisplayClockToMinutes = (displayClock) => {
  if (!displayClock) return 0;
  const clockStr = displayClock.toString().trim();
  
  if (/^(HT|Halftime|Half-Time|Half Time)$/i.test(clockStr)) {
    return 45;
  }
  
  if (clockStr.includes('+')) {
    const parts = clockStr.split('+');
    const base = parseInt(parts[0]) || 0;
    const extra = parseInt(parts[1]) || 0;
    return base + extra;
  }
  
  if (clockStr.includes(':')) {
    const parts = clockStr.split(':');
    return parseInt(parts[0]) || 0;
  }
  
  const match = clockStr.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

export async function GET({ request }) {
  const matchId = request.headers.get('x-match-id');
  const now = Date.now();
  const cache = getCache();
  const db = await getDb();

  logDebug(`Incoming request URL: ${request.url}`);
  logDebug(`Parsed matchId: ${matchId}`);

  if (!cache.details) cache.details = {};

  // Case 1: Fetch detailed match by ID (MatchZone)
  if (matchId) {
    const cachedDetail = cache.details[matchId];
    
    // Helper to merge latest rants from file store into player list
    const mergeRantsForMatch = (matchData) => {
      const rantsForMatch = db.rants?.[matchId] || {};
      const mergeRants = (player) => {
        const rantsData = rantsForMatch[player.id] || { totalRants: 0, rants: {} };
        return {
          ...player,
          totalRants: rantsData.totalRants,
          rants: rantsData.rants
        };
      };
      
      return {
        ...matchData,
        homeTeam: {
          ...matchData.homeTeam,
          lineup: (matchData.homeTeam.lineup || []).map(mergeRants),
          bench: (matchData.homeTeam.bench || []).map(mergeRants)
        },
        awayTeam: {
          ...matchData.awayTeam,
          lineup: (matchData.awayTeam.lineup || []).map(mergeRants),
          bench: (matchData.awayTeam.bench || []).map(mergeRants)
        }
      };
    };

    if (cachedDetail && cachedDetail.timestamp && cachedDetail.match) {
      const status = cachedDetail.match.status;
      const isLive = status === 'LIVE';
      const isFinished = status === 'FINISHED';
      
      let cacheTTL = 5 * 60 * 1000; // 5 min for scheduled matches
      if (isLive) cacheTTL = 30 * 1000; // 30 sec for live
      else if (isFinished) cacheTTL = 12 * 60 * 60 * 1000; // 12 hours for finished

      const age = now - cachedDetail.timestamp;
      logDebug(`Cached match detail age: ${Math.round(age / 1000)}s, TTL: ${Math.round(cacheTTL / 1000)}s`);

      if (age < cacheTTL) {
        logDebug(`Serving match ${matchId} from cache.`);
        const matchWithRants = mergeRantsForMatch(cachedDetail.match);
        return new Response(JSON.stringify({ ...matchWithRants, fromCache: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    logDebug(`Fetching detailed match ${matchId} from ESPN...`);
    try {
      const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${matchId}`);
      if (!summaryRes.ok) {
        throw new Error(`ESPN returned status ${summaryRes.status}`);
      }
      const summaryData = await summaryRes.json();

      const header = summaryData.header;
      const competition = header?.competitions?.[0];
      if (!competition) {
        throw new Error("Invalid summary format: Competition details missing.");
      }

      const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
      if (!homeCompetitor || !awayCompetitor) {
        throw new Error("Invalid summary format: Competitors missing.");
      }

      // Extract rosters
      let homeLineup = [];
      let awayLineup = [];
      let homeBench = [];
      let awayBench = [];

      const rosters = summaryData.rosters || [];
      const homeRosterObj = rosters.find(r => r.homeAway === 'home');
      const awayRosterObj = rosters.find(r => r.homeAway === 'away');

      const parseRosterPlayer = (p) => ({
        id: p.athlete?.id || `player_${p.jersey || Math.floor(Math.random() * 1000)}`,
        name: p.athlete?.displayName || p.athlete?.fullName || 'بازیکن',
        position: mapPosition(p.position?.abbreviation, p.position?.name),
        shirtNumber: parseInt(p.jersey) || 0,
        photoUrl: p.athlete?.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.athlete.id}.png` : ''
      });

      if (homeRosterObj && homeRosterObj.roster) {
        homeLineup = homeRosterObj.roster.filter(p => p.starter === true).map(parseRosterPlayer);
        homeBench = homeRosterObj.roster.filter(p => p.starter === false).map(parseRosterPlayer);
      }

      if (awayRosterObj && awayRosterObj.roster) {
        awayLineup = awayRosterObj.roster.filter(p => p.starter === true).map(parseRosterPlayer);
        awayBench = awayRosterObj.roster.filter(p => p.starter === false).map(parseRosterPlayer);
      }

      const state = competition.status?.type?.state;
      const isLive = state === 'in';
      const isFinished = state === 'post';
      const mappedStatus = isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'WAITING';

      let displayClock = competition.status?.displayClock || '';
      const statusName = competition.status?.type?.name || '';
      const statusDetail = competition.status?.type?.detail || '';
      const statusDesc = competition.status?.type?.description || '';
      if (
        statusName === 'STATUS_HALFTIME' || 
        /^(HT|Halftime|Half-Time|Half Time)$/i.test(statusDetail) || 
        /^(HT|Halftime|Half-Time|Half Time)$/i.test(statusDesc)
      ) {
        displayClock = 'HT';
      }
      const elapsed = parseDisplayClockToMinutes(displayClock);

      const formattedMatch = {
        id: matchId,
        utcDate: competition.date,
        status: mappedStatus,
        elapsed: elapsed,
        displayClock: displayClock,
        homeTeam: {
          id: homeCompetitor.id,
          name: homeCompetitor.team?.displayName || homeCompetitor.team?.name || 'میزبان',
          crest: homeCompetitor.team?.logo || homeCompetitor.team?.logos?.[0]?.href || '',
          lineup: homeLineup,
          bench: homeBench
        },
        awayTeam: {
          id: awayCompetitor.id,
          name: awayCompetitor.team?.displayName || awayCompetitor.team?.name || 'میهمان',
          crest: awayCompetitor.team?.logo || awayCompetitor.team?.logos?.[0]?.href || '',
          lineup: awayLineup,
          bench: awayBench
        },
        score: {
          home: parseInt(homeCompetitor.score) || 0,
          away: parseInt(awayCompetitor.score) || 0
        }
      };

      logDebug(`Successfully parsed detailed match for ${matchId}:`, {
        homeTeam: formattedMatch.homeTeam.name,
        awayTeam: formattedMatch.awayTeam.name,
        homeLineupCount: homeLineup.length,
        awayLineupCount: awayLineup.length,
        score: formattedMatch.score
      });

      // Cache raw formatted match details (without user rants merged, to keep clean cache)
      cache.details[matchId] = {
        timestamp: now,
        match: formattedMatch
      };
      saveCache(cache);

      const matchWithRants = mergeRantsForMatch(formattedMatch);

      return new Response(JSON.stringify(matchWithRants), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logDebug(`Error fetching detailed match ${matchId}:`, error.message);
      if (cachedDetail && cachedDetail.match) {
        logDebug("Serving expired detail cache as fallback.");
        const matchWithRants = mergeRantsForMatch(cachedDetail.match);
        return new Response(JSON.stringify({ ...matchWithRants, fromCacheFallback: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Case 2: Fetch list of matches (MatchesList)
  else {
    const cachedMatches = cache.matches;
    if (cachedMatches && cachedMatches.timestamp && cachedMatches.list) {
      const age = now - cachedMatches.timestamp;
      logDebug(`Cached matches list age: ${Math.round(age / 1000)}s, TTL: 30s`);
      if (age < 30 * 1000) {
        logDebug("Serving matches list from cache.");
        return new Response(JSON.stringify({ matches: cachedMatches.list, fromCache: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    logDebug("Fetching matches list from ESPN scoreboard...");
    try {
      const scoreboardRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
      if (!scoreboardRes.ok) {
        throw new Error(`ESPN Scoreboard returned status ${scoreboardRes.status}`);
      }
      const scoreboardData = await scoreboardRes.json();
      const events = scoreboardData.events || [];
      logDebug(`Scoreboard events count: ${events.length}`);

      const list = events.map(event => {
        const competition = event.competitions?.[0];
        const homeCompetitor = competition?.competitors?.find(c => c.homeAway === 'home');
        const awayCompetitor = competition?.competitors?.find(c => c.homeAway === 'away');
        const state = event.status?.type?.state;
        const isLive = state === 'in';
        const isFinished = state === 'post';
        const mappedStatus = isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'WAITING';
        let displayClock = event.status?.displayClock || '';
        const statusName = event.status?.type?.name || '';
        const statusDetail = event.status?.type?.detail || '';
        const statusDesc = event.status?.type?.description || '';
        if (
          statusName === 'STATUS_HALFTIME' || 
          /^(HT|Halftime|Half-Time|Half Time)$/i.test(statusDetail) || 
          /^(HT|Halftime|Half-Time|Half Time)$/i.test(statusDesc)
        ) {
          displayClock = 'HT';
        }
        const elapsed = parseDisplayClockToMinutes(displayClock);

        return {
          id: event.id,
          utcDate: event.date,
          status: mappedStatus,
          elapsed: elapsed,
          displayClock: displayClock,
          homeTeam: {
            name: homeCompetitor?.team?.displayName || homeCompetitor?.team?.name || 'میزبان',
            crest: homeCompetitor?.team?.logo || homeCompetitor?.team?.logos?.[0]?.href || '',
          },
          awayTeam: {
            name: awayCompetitor?.team?.displayName || awayCompetitor?.team?.name || 'میهمان',
            crest: awayCompetitor?.team?.logo || awayCompetitor?.team?.logos?.[0]?.href || '',
          },
          score: {
            home: parseInt(homeCompetitor?.score) || 0,
            away: parseInt(awayCompetitor?.score) || 0
          }
        };
      });

      logDebug(`Successfully parsed ${list.length} matches for list.`);

      cache.matches = {
        timestamp: now,
        list: list
      };
      saveCache(cache);

      return new Response(JSON.stringify({ matches: list }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      logDebug("Error fetching matches list:", error.message);
      if (cachedMatches && cachedMatches.list) {
        logDebug("Serving expired list cache as fallback.");
        return new Response(JSON.stringify({ matches: cachedMatches.list, fromCacheFallback: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

// POST endpoint handler to save player rants in persistent hybrid store
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { matchId, playerId, playerName, playerPhoto, teamId, teamName, teamCrest, rantKey, userId } = body;
    
    if (!matchId || !playerId || !rantKey) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const playerRants = await addRant({
      matchId,
      playerId,
      playerName,
      playerPhoto,
      teamId,
      teamName,
      teamCrest,
      rantKey,
      userId
    });

    logDebug(`Rant registered in DB for player ${playerId} in match ${matchId} (key: ${rantKey}, user: ${userId})`);

    // Broadcast the update to all live connected clients watching this match
    try {
      broadcastToMatch(matchId, {
        matchId,
        playerId,
        rantKey,
        totalRants: playerRants.totalRants,
        rants: playerRants.rants
      });
      logDebug(`Successfully broadcasted live update to match ${matchId} for player ${playerId}`);
    } catch (broadcastErr) {
      logDebug(`Failed to broadcast: ${broadcastErr.message}`);
    }

    return new Response(JSON.stringify({ success: true, playerRants }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
