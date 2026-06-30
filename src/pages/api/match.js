export const prerender = false;
import { getMatchRants, addRant, saveMatchDate } from '../../utils/db.js';

// Initialize global variables to store cache in RAM
globalThis.matchCache = globalThis.matchCache || { matches: null, details: {} };

const SIMULATED_MATCH_ID = "simulated-match";

const getSimulatedMatchState = () => {
  const now = Date.now();
  const cycleMs = 100 * 60 * 1000; // 100-minute cycle: 45 min first half, 10 min HT, 45 min second half
  const cycleTime = now % cycleMs;
  
  let elapsedMin = Math.floor(cycleTime / 60000);
  let displayClock = "";
  let status = "LIVE";
  let score = { home: 0, away: 0 };
  
  if (elapsedMin < 45) {
    // First Half (0 - 44 mins)
    displayClock = String(elapsedMin + 1);
    if (elapsedMin >= 16) score.home = 1; // Havertz 16'
    if (elapsedMin >= 36) score.away = 1; // Locadia 36'
  } else if (elapsedMin >= 45 && elapsedMin < 55) {
    // Halftime (10 mins)
    displayClock = "HT";
    elapsedMin = 45;
    score = { home: 1, away: 1 };
  } else if (elapsedMin >= 55 && elapsedMin < 100) {
    // Second Half (45 - 89 mins of actual game time)
    const actualGameMin = elapsedMin - 10; // offset the halftime delay
    displayClock = String(actualGameMin + 1);
    score.home = 1;
    score.away = 1;
    if (actualGameMin >= 52) score.home = 2; // Musiala 52'
    if (actualGameMin >= 72) score.home = 3; // Undav 72'
    if (actualGameMin >= 86) score.away = 2; // Locadia 86'
    elapsedMin = actualGameMin;
  }
  
  return {
    elapsed: elapsedMin,
    displayClock,
    status,
    score
  };
};

const SIMULATED_HOME_TEAM = {
  id: "germany",
  name: "Germany",
  crest: "https://a.espncdn.com/i/teamlogos/soccer/500/381.png",
  lineup: [
    { id: "128174", name: "Marc-André ter Stegen", position: "GOALKEEPER", shirtNumber: 1, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/128174.png" },
    { id: "158588", name: "Antonio Rüdiger", position: "DEFENDER", shirtNumber: 2, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/158588.png" },
    { id: "210257", name: "Jonathan Tah", position: "DEFENDER", shirtNumber: 4, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/210257.png" },
    { id: "298495", name: "David Raum", position: "DEFENDER", shirtNumber: 3, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/298495.png" },
    { id: "240673", name: "Joshua Kimmich", position: "DEFENDER", shirtNumber: 6, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/240673.png" },
    { id: "151368", name: "Pascal Groß", position: "MIDFIELDER", shirtNumber: 5, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/151368.png" },
    { id: "242207", name: "Robert Andrich", position: "MIDFIELDER", shirtNumber: 8, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/242207.png" },
    { id: "257321", name: "Felix Nmecha", position: "MIDFIELDER", shirtNumber: 16, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/257321.png" },
    { id: "296716", name: "Jamal Musiala", position: "MIDFIELDER", shirtNumber: 10, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/296716.png" },
    { id: "279288", name: "Kai Havertz", position: "FORWARD", shirtNumber: 7, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/279288.png" },
    { id: "304388", name: "Florian Wirtz", position: "FORWARD", shirtNumber: 17, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/304388.png" }
  ],
  bench: [
    { id: "305541", name: "Deniz Undav", position: "FORWARD", shirtNumber: 20, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/305541.png" },
    { id: "203403", name: "Leroy Sané", position: "FORWARD", shirtNumber: 19, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/203403.png" },
    { id: "201198", name: "Niclas Füllkrug", position: "FORWARD", shirtNumber: 9, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/201198.png" },
    { id: "286829", name: "Nico Schlotterbeck", position: "DEFENDER", shirtNumber: 15, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/286829.png" }
  ]
};

const SIMULATED_AWAY_TEAM = {
  id: "curacao",
  name: "Curaçao",
  crest: "https://a.espncdn.com/i/teamlogos/soccer/500/6900.png",
  lineup: [
    { id: "147983", name: "Eloy Room", position: "GOALKEEPER", shirtNumber: 1, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/147983.png" },
    { id: "160759", name: "Cuco Martina", position: "DEFENDER", shirtNumber: 2, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/160759.png" },
    { id: "221590", name: "Jurich Carolina", position: "DEFENDER", shirtNumber: 4, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/221590.png" },
    { id: "220803", name: "Sherel Floranus", position: "DEFENDER", shirtNumber: 3, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/220803.png" },
    { id: "305719", name: "Roshon van Eijma", position: "DEFENDER", shirtNumber: 5, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/305719.png" },
    { id: "103597", name: "Vurnon Anita", position: "MIDFIELDER", shirtNumber: 6, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/103597.png" },
    { id: "132646", name: "Leandro Bacuna", position: "MIDFIELDER", shirtNumber: 7, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/132646.png" },
    { id: "219503", name: "Juninho Bacuna", position: "MIDFIELDER", shirtNumber: 10, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/219503.png" },
    { id: "230678", name: "Brandley Kuwas", position: "MIDFIELDER", shirtNumber: 8, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/230678.png" },
    { id: "172553", name: "Jürgen Locadia", position: "FORWARD", shirtNumber: 9, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/172553.png" },
    { id: "186835", name: "Rangelo Janga", position: "FORWARD", shirtNumber: 11, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/186835.png" }
  ],
  bench: [
    { id: "200236", name: "Kenji Gorré", position: "FORWARD", shirtNumber: 14, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/200236.png" },
    { id: "204278", name: "Jafar Arias", position: "FORWARD", shirtNumber: 19, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/204278.png" },
    { id: "200156", name: "Gervane Kastaneer", position: "FORWARD", shirtNumber: 17, photoUrl: "https://a.espncdn.com/i/headshots/soccer/players/full/200156.png" }
  ]
};


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
  const url = new URL(request.url);
  const matchId = request.headers.get('x-match-id') || url.searchParams.get('matchId') || url.searchParams.get('match_id');
  const now = Date.now();
  const cache = getCache();

  const simulateToggle = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SIMULATE_MATCH === 'true') ||
                         (typeof process !== 'undefined' && process.env?.PUBLIC_SIMULATE_MATCH === 'true');

  logDebug(`Incoming request URL: ${request.url}`);
  logDebug(`Parsed matchId: ${matchId}`);

  if (!cache.details) cache.details = {};

  // Case 1: Fetch detailed match by ID (MatchZone)
  if (matchId) {
    const cachedDetail = cache.details[matchId];
    const rantsForMatch = await getMatchRants(matchId);
    
    // Helper to merge latest rants from file store into player list
    const mergeRantsForMatch = (matchData) => {
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

    if (matchId === SIMULATED_MATCH_ID) {
      const simState = getSimulatedMatchState();
      const formattedMatch = {
        id: SIMULATED_MATCH_ID,
        utcDate: new Date().toISOString(),
        status: simState.status,
        elapsed: simState.elapsed,
        displayClock: simState.displayClock,
        homeTeam: JSON.parse(JSON.stringify(SIMULATED_HOME_TEAM)),
        awayTeam: JSON.parse(JSON.stringify(SIMULATED_AWAY_TEAM)),
        score: simState.score
      };
      const matchWithRants = mergeRantsForMatch(formattedMatch);
      return new Response(JSON.stringify(matchWithRants), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

      const parseRosterPlayer = (p) => {
        let subbedIn = false;
        let subbedInMin = null;
        if (p.subbedIn === true) {
          subbedIn = true;
        } else if (p.subbedIn && typeof p.subbedIn === 'object') {
          subbedIn = p.subbedIn.didSub === true;
          if (p.subbedIn.time?.displayClock) {
            subbedInMin = parseInt(p.subbedIn.time.displayClock) || null;
          }
        }

        let subbedOut = false;
        let subbedOutMin = null;
        if (p.subbedOut === true) {
          subbedOut = true;
        } else if (p.subbedOut && typeof p.subbedOut === 'object') {
          subbedOut = p.subbedOut.didSub === true;
          if (p.subbedOut.time?.displayClock) {
            subbedOutMin = parseInt(p.subbedOut.time.displayClock) || null;
          }
        }

        return {
          id: p.athlete?.id || `player_${p.jersey || Math.floor(Math.random() * 1000)}`,
          name: p.athlete?.displayName || p.athlete?.fullName || 'بازیکن',
          position: mapPosition(p.position?.abbreviation, p.position?.name),
          shirtNumber: parseInt(p.jersey) || 0,
          photoUrl: p.athlete?.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.athlete.id}.png` : '',
          starter: p.starter === true,
          subbedIn,
          subbedInMin,
          subbedOut,
          subbedOutMin
        };
      };

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

      // Proactively save match date persistently
      await saveMatchDate(matchId, formattedMatch.utcDate);

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
    let list = [];
    let isError = false;
    let errorMsg = "";

    const cachedMatches = cache.matches;
    if (cachedMatches && cachedMatches.timestamp && cachedMatches.list) {
      const age = now - cachedMatches.timestamp;
      logDebug(`Cached matches list age: ${Math.round(age / 1000)}s, TTL: 30s`);
      if (age < 30 * 1000) {
        logDebug("Serving matches list from cache.");
        list = [...cachedMatches.list];
      }
    }

    if (list.length === 0) {
      logDebug("Fetching matches list from ESPN scoreboard...");
      try {
        const scoreboardRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
        if (!scoreboardRes.ok) {
          throw new Error(`ESPN Scoreboard returned status ${scoreboardRes.status}`);
        }
        const scoreboardData = await scoreboardRes.json();
        const events = scoreboardData.events || [];
        logDebug(`Scoreboard events count: ${events.length}`);

        list = events.map(event => {
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

        // Proactively save all match dates persistently
        for (const match of list) {
          await saveMatchDate(match.id, match.utcDate);
        }

      } catch (error) {
        logDebug("Error fetching matches list:", error.message);
        if (cachedMatches && cachedMatches.list) {
          logDebug("Serving expired list cache as fallback.");
          list = [...cachedMatches.list];
        } else {
          isError = true;
          errorMsg = error.message;
        }
      }
    }

    if (simulateToggle) {
      const simState = getSimulatedMatchState();
      const simMatch = {
        id: SIMULATED_MATCH_ID,
        utcDate: new Date().toISOString(),
        status: simState.status,
        elapsed: simState.elapsed,
        displayClock: simState.displayClock,
        homeTeam: {
          name: SIMULATED_HOME_TEAM.name,
          crest: SIMULATED_HOME_TEAM.crest
        },
        awayTeam: {
          name: SIMULATED_AWAY_TEAM.name,
          crest: SIMULATED_AWAY_TEAM.crest
        },
        score: simState.score
      };
      list = [simMatch, ...list.filter(m => m.id !== SIMULATED_MATCH_ID)];
      isError = false; // Reset error state if simulation is successfully appended
    }

    if (isError) {
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ matches: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST endpoint handler to save player rants in persistent hybrid store
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { matchId, playerId, playerName, playerPhoto, teamId, teamName, teamCrest, rantKey, userId, userName, userAvatar } = body;
    
    if (!matchId || !rantKey) {
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
      userId,
      userName,
      userAvatar
    });

    logDebug(`Rant registered in DB for player ${playerId} in match ${matchId} (key: ${rantKey}, user: ${userId})`);

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
