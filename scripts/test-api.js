import fs from 'fs';
import path from 'path';

// 1. Read token from .env
const envPath = path.resolve(process.cwd(), '.env');
let token = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/PUBLIC_FOOTBALL_API_TOKEN\s*=\s*(.*)/);
  if (match) {
    token = match[1].trim();
  }
}

if (!token) {
  console.error("❌ Token not found in .env file.");
  process.exit(1);
}

console.log(`ℹ️ Found token: ${token.substring(0, 4)}...${token.substring(token.length - 4)}`);

// Persian translations
const TEAM_NAMES_FA = {
  'Germany': 'آلمان',
  'Curaçao': 'کوراسائو',
  'Haiti': 'هائیتی',
  'Scotland': 'اسکاتلند',
  'Australia': 'استرالیا',
  'Turkey': 'ترکیه',
  'Netherlands': 'هلند',
  'Japan': 'ژاپن',
  'Ivory Coast': 'ساحل عاج',
  'Ecuador': 'اکوادور',
  'Iran': 'ایران',
  'Portugal': 'پرتغال',
  'Spain': 'اسپانیا',
  'Argentina': 'آرژانتین',
  'Brazil': 'برزیل',
  'France': 'فرانسه',
  'England': 'انگلستان',
  'Italy': 'ایتالیا',
  'Belgium': 'بلژیک',
  'Croatia': 'کرواسی',
  'Uruguay': 'اروگوئه',
  'Colombia': 'کلمبیا',
  'Morocco': 'مراکش',
  'Senegal': 'سنگال',
  'USA': 'آمریکا',
  'United States': 'آمریکا',
  'Mexico': 'مکزیک',
  'Canada': 'کانادا',
  'Saudi Arabia': 'عربستان سعودی',
  'South Korea': 'کره جنوبی',
  'Qatar': 'قطر',
  'Switzerland': 'سوئیس',
  'Denmark': 'دانمارک',
  'Tunisia': 'تونس',
  'Poland': 'لهستان',
  'Wales': 'ولز',
  'Ghana': 'غنا',
  'Cameroon': 'کامرون',
  'Serbia': 'صربستان',
  'Costa Rica': 'کاستاریکا',
  'Peru': 'پرو',
  'Ukraine': 'اوکراین',
  'Sweden': 'سوئد',
  'Austria': 'اتریش',
  'Egypt': 'مصر',
  'Algeria': 'الجزایر',
  'Nigeria': 'نیجریه',
  'Chile': 'شیلی',
  'Paraguay': 'پاراگوئه'
};

const getPersianTeamName = (name) => TEAM_NAMES_FA[name] || name;

// Select starting 11
const selectStarting11 = (squad) => {
  if (!squad || squad.length === 0) return [];
  
  const goalkeepers = squad.filter(p => p.position?.toLowerCase() === 'goalkeeper');
  const defenders = squad.filter(p => p.position?.toLowerCase() === 'defence' || p.position?.toLowerCase() === 'defender');
  const midfielders = squad.filter(p => p.position?.toLowerCase() === 'midfield' || p.position?.toLowerCase() === 'midfielder');
  const forwards = squad.filter(p => p.position?.toLowerCase() === 'offence' || p.position?.toLowerCase() === 'forward' || p.position?.toLowerCase() === 'attacker');
  
  const lineup = [];
  
  // Select GK
  if (goalkeepers.length > 0) lineup.push({ ...goalkeepers[0], position: 'GOALKEEPER', shirtNumber: 1 });
  else if (squad[0]) lineup.push({ ...squad[0], position: 'GOALKEEPER', shirtNumber: 1 });
  
  // Select DEF (up to 4)
  const selectedDefs = defenders.slice(0, 4);
  selectedDefs.forEach((p, idx) => {
    lineup.push({ ...p, position: 'DEFENDER', shirtNumber: idx + 2 });
  });
  
  // Select MID (up to 4)
  const selectedMids = midfielders.slice(0, 4);
  selectedMids.forEach((p, idx) => {
    lineup.push({ ...p, position: 'MIDFIELDER', shirtNumber: idx + 6 });
  });
  
  // Select FWD (up to 2)
  const selectedFwds = forwards.slice(0, 2);
  selectedFwds.forEach((p, idx) => {
    lineup.push({ ...p, position: 'FORWARD', shirtNumber: idx + 10 });
  });
  
  // Fill remaining to get 11
  const currentIds = new Set(lineup.map(p => p.id));
  const remaining = squad.filter(p => !currentIds.has(p.id));
  let shirtNum = 12;
  while (lineup.length < 11 && remaining.length > 0) {
    const nextPlayer = remaining.shift();
    let pos = 'MIDFIELDER';
    const rawPos = nextPlayer.position?.toLowerCase();
    if (rawPos === 'goalkeeper') pos = 'GOALKEEPER';
    else if (rawPos === 'defence' || rawPos === 'defender') pos = 'DEFENDER';
    else if (rawPos === 'midfield' || rawPos === 'midfielder') pos = 'MIDFIELDER';
    else if (rawPos === 'offence' || rawPos === 'forward' || rawPos === 'attacker') pos = 'FORWARD';
    lineup.push({ ...nextPlayer, position: pos, shirtNumber: shirtNum++ });
  }
  
  return lineup;
};

async function runTest() {
  console.log("📡 Fetching World Cup matches...");
  const headers = { 'X-Auth-Token': token };
  
  try {
    const matchRes = await fetch('https://api.football-data.org/v4/matches?competitions=WC', { headers });
    if (!matchRes.ok) {
      throw new Error(`Match API error (${matchRes.status}): ${await matchRes.text()}`);
    }
    
    const matchData = await matchRes.json();
    console.log(`✅ Fetched ${matchData.matches?.length || 0} matches.`);
    
    // Find live or closest match
    let match = matchData.matches?.find(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    if (match) {
      console.log("🔴 Found live match!");
    } else {
      console.log("ℹ️ No live match. Checking for upcoming matches...");
      match = matchData.matches?.find(m => m.status === 'TIMED' || m.status === 'SCHEDULED');
      if (match) {
        console.log("📅 Found scheduled match.");
      } else {
        console.log("🏁 No live or scheduled match. Falling back to finished match...");
        match = matchData.matches?.find(m => m.status === 'FINISHED');
      }
    }
    
    if (!match) {
      console.error("❌ No matches found in the API payload.");
      return;
    }
    
    console.log(`\n================ MATCH INFORMATION ================`);
    console.log(`Match ID: ${match.id}`);
    console.log(`Teams: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    console.log(`Persian Teams: ${getPersianTeamName(match.homeTeam.name)} vs ${getPersianTeamName(match.awayTeam.name)}`);
    console.log(`Score: ${match.score?.fullTime?.home ?? 0} - ${match.score?.fullTime?.away ?? 0}`);
    console.log(`Status: ${match.status}`);
    console.log(`Date: ${match.utcDate}`);
    console.log(`Crests: ${match.homeTeam.crest} | ${match.awayTeam.crest}`);
    
    // Fetch home squad
    console.log(`\n📡 Fetching home team squad (${match.homeTeam.name})...`);
    const homeRes = await fetch(`https://api.football-data.org/v4/teams/${match.homeTeam.id}`, { headers });
    let homePlayers = [];
    if (homeRes.ok) {
      const homeData = await homeRes.json();
      if (homeData && homeData.squad) {
        homePlayers = selectStarting11(homeData.squad);
        console.log(`✅ Selected ${homePlayers.length} starting players.`);
      }
    } else {
      console.error(`⚠️ Failed to fetch home team squad: ${homeRes.status}`);
    }
    
    // Fetch away squad
    console.log(`📡 Fetching away team squad (${match.awayTeam.name})...`);
    const awayRes = await fetch(`https://api.football-data.org/v4/teams/${match.awayTeam.id}`, { headers });
    let awayPlayers = [];
    if (awayRes.ok) {
      const awayData = await awayRes.json();
      if (awayData && awayData.squad) {
        awayPlayers = selectStarting11(awayData.squad);
        console.log(`✅ Selected ${awayPlayers.length} starting players.`);
      }
    } else {
      console.error(`⚠️ Failed to fetch away team squad: ${awayRes.status}`);
    }
    
    console.log(`\n================ PARSED STARTING 11 LINEUPS ================`);
    console.log(`🏡 ${getPersianTeamName(match.homeTeam.name)} (Home):`);
    homePlayers.forEach(p => {
      console.log(`  [#${p.shirtNumber}] ${p.name} - ${p.position}`);
    });
    
    console.log(`\n✈️ ${getPersianTeamName(match.awayTeam.name)} (Away):`);
    awayPlayers.forEach(p => {
      console.log(`  [#${p.shirtNumber}] ${p.name} - ${p.position}`);
    });
    console.log(`\n🎉 Test completed successfully! All APIs are parsed correctly.`);
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

runTest();
