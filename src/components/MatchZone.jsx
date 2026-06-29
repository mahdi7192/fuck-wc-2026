import React, { useState, useEffect, useRef } from "react";
import RantDialog from "./RantDialog";
import {
  getPersianTeamName,
  formatMatchTime,
  formatMatchDate,
  renderCrest,
  getTeamFlag,
} from "../utils/helpers";

// Helper to normalize player names for searching on TheSportsDB
const normalizePlayerName = (name) => {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-zA-Z\s.-]/g, "") // remove non-alphabetic characters except spaces, dots, hyphens
    .replace(/\s+/g, " ") // collapse spaces
    .trim();
};

// Helper to fetch player photo from TheSportsDB
const fetchPlayerPhoto = async (playerName) => {
  if (!playerName) return null;
  const cleanName = normalizePlayerName(playerName);
  if (!cleanName || cleanName.length < 3) return null;

  const cacheKey = `player_photo_${cleanName.replace(/\s+/g, "_")}`;
  try {
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      if (cachedStr === "null") return null;
      try {
        const cached = JSON.parse(cachedStr);
        if (cached && typeof cached === "object" && "timestamp" in cached) {
          const age = Date.now() - cached.timestamp;
          const fiveDays = 5 * 24 * 60 * 60 * 1000;
          if (age < fiveDays) {
            return cached.value === "null" || cached.value === null ? null : cached.value;
          }
        } else {
          // If it successfully parsed but isn't our schema, fallback to treating it as old cache format
          return cachedStr;
        }
      } catch (err) {
        // If parsing fails (old cache format), treat it as a valid photo URL cache
        return cachedStr;
      }
    }
  } catch (e) {
    // ignore localStorage access errors
  }

  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(cleanName)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.player && data.player.length > 0) {
      const playerInfo = data.player[0];
      const photoUrl = playerInfo.strCutout || playerInfo.strThumb || null;
      if (photoUrl) {
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ value: photoUrl, timestamp: Date.now() }),
          );
        } catch (e) {}
        return photoUrl;
      }
    }
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ value: null, timestamp: Date.now() }),
      );
    } catch (e) {}
    return null;
  } catch (error) {
    console.error(`Error fetching photo for ${playerName}:`, error);
    return null;
  }
};

// Predefined list of Persian football rants
const PREDEFINED_RANTS = [
  { key: "pass", persianText: "پاس بده دیگه! ⚽" },
  { key: "shoot", persianText: "چرا شوت نمیزنی؟ 😤" },
  { key: "dribble", persianText: "مگه مجبوری دریبل بزنی؟ 👟" },
  { key: "miss", persianText: "دروازه خالی رو گل نکرد! 🤦‍♂️" },
  { key: "lazy", persianText: "داره قدم میزنه! 🚶" },
  { key: "defense", persianText: "دفاع سوراخ! 🕳️" },
  { key: "sub", persianText: "مربی تعویضش کن! 🔄" },
  { key: "sleep", persianText: "اصلا تو باغ نیست! 🌳" },
  { key: "lose", persianText: "توپ لو دادن تخصصشه! 📉" },
  { key: "slow", persianText: "کند مثل حلزون! 🐌" },
];

// Helper to generate a generic 11-player lineup if API squad details are unavailable
const generateGenericLineup = (side) => {
  const positions = [
    "GOALKEEPER",
    "DEFENDER",
    "DEFENDER",
    "DEFENDER",
    "DEFENDER",
    "MIDFIELDER",
    "MIDFIELDER",
    "MIDFIELDER",
    "MIDFIELDER",
    "FORWARD",
    "FORWARD",
  ];
  return positions.map((pos, idx) => ({
    id: (side === "home" ? 100 : 200) + idx,
    name: `بازیکن ${side === "home" ? "میزبان" : "میهمان"} ${idx + 1}`,
    position: pos,
    shirtNumber: idx + 1,
  }));
};

const positionWeights = {
  GOALKEEPER: 1,
  DEFENDER: 2,
  MIDFIELDER: 3,
  FORWARD: 4,
};

// Sort 11-player array strictly by position
const sortPlayers = (playerList) => {
  return [...playerList].sort((a, b) => {
    const weightA = positionWeights[a.position?.toUpperCase()] || 99;
    const weightB = positionWeights[b.position?.toUpperCase()] || 99;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return (a.shirtNumber || 0) - (b.shirtNumber || 0);
  });
};

// Select a standard starting 11 (1 GK, 4 DEF, 4 MID, 2 FWD) from the team squad
const selectStarting11 = (squad) => {
  if (!squad || squad.length === 0) return [];

  const goalkeepers = squad.filter(
    (p) => p.position?.toLowerCase() === "goalkeeper",
  );
  const defenders = squad.filter(
    (p) =>
      p.position?.toLowerCase() === "defence" ||
      p.position?.toLowerCase() === "defender",
  );
  const midfielders = squad.filter(
    (p) =>
      p.position?.toLowerCase() === "midfield" ||
      p.position?.toLowerCase() === "midfielder",
  );
  const forwards = squad.filter(
    (p) =>
      p.position?.toLowerCase() === "offence" ||
      p.position?.toLowerCase() === "forward" ||
      p.position?.toLowerCase() === "attacker",
  );

  const lineup = [];

  // Select GK
  if (goalkeepers.length > 0) {
    lineup.push({ ...goalkeepers[0], position: "GOALKEEPER", shirtNumber: 1 });
  } else if (squad[0]) {
    lineup.push({ ...squad[0], position: "GOALKEEPER", shirtNumber: 1 });
  }

  // Select DEF (up to 4)
  const selectedDefs = defenders.slice(0, 4);
  selectedDefs.forEach((p, idx) => {
    lineup.push({
      ...p,
      position: "DEFENDER",
      shirtNumber: p.shirtNumber || idx + 2,
    });
  });

  // Select MID (up to 4)
  const selectedMids = midfielders.slice(0, 4);
  selectedMids.forEach((p, idx) => {
    lineup.push({
      ...p,
      position: "MIDFIELDER",
      shirtNumber: p.shirtNumber || idx + 6,
    });
  });

  // Select FWD (up to 2)
  const selectedFwds = forwards.slice(0, 2);
  selectedFwds.forEach((p, idx) => {
    lineup.push({
      ...p,
      position: "FORWARD",
      shirtNumber: p.shirtNumber || idx + 10,
    });
  });

  // If we don't have 11 players yet, fill from remaining squad
  const currentIds = new Set(lineup.map((p) => p.id));
  const remaining = squad.filter((p) => !currentIds.has(p.id));
  let shirtNum = 12;
  while (lineup.length < 11 && remaining.length > 0) {
    const nextPlayer = remaining.shift();
    let pos = "MIDFIELDER";
    const rawPos = nextPlayer.position?.toLowerCase();
    if (rawPos === "goalkeeper") pos = "GOALKEEPER";
    else if (rawPos === "defence" || rawPos === "defender") pos = "DEFENDER";
    else if (rawPos === "midfield" || rawPos === "midfielder")
      pos = "MIDFIELDER";
    else if (
      rawPos === "offence" ||
      rawPos === "forward" ||
      rawPos === "attacker"
    )
      pos = "FORWARD";

    lineup.push({ ...nextPlayer, position: pos, shirtNumber: shirtNum++ });
  }

  return lineup;
};

export default function MatchZone({ matchId, onBack, userProfile, userId }) {
  const [authToken, setAuthToken] = useState(
    import.meta.env.PUBLIC_FOOTBALL_API_TOKEN ||
      "ef19c292505a42a8acb1fe4c95ef98f3",
  );
  const [matchStatus, setMatchStatus] = useState("WAITING"); // WAITING, LIVE, FINISHED

  // New States for profile, tabs, predictions & rain
  const [matchTab, setMatchTab] = useState('lineup'); // 'lineup' | 'history'
  const [rantHistory, setRantHistory] = useState([]);
  const [userPrediction, setUserPrediction] = useState(null);
  const [rainElements, setRainElements] = useState([]);
  const lastRainTime = useRef(0);
  const [chatInput, setChatInput] = useState("");
  const [utcDate, setUtcDate] = useState(null);

  // Teams State
  const [homeTeam, setHomeTeam] = useState({
    name: "در حال بارگذاری...",
    crest: "",
  });
  const [awayTeam, setAwayTeam] = useState({
    name: "در حال بارگذاری...",
    crest: "",
  });
  const [matchMinutes, setMatchMinutes] = useState(0);
  const [matchScore, setMatchScore] = useState({ home: 0, away: 0 });

  // Players State
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [homeBench, setHomeBench] = useState([]);
  const [awayBench, setAwayBench] = useState([]);

  // Floating Soccer-Balls
  const [floatingBalls, setFloatingBalls] = useState([]);

  // Real API integration state
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // UI States
  const [waitingCountdown, setWaitingCountdown] = useState(10);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const getCookie = (name) => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  };

  const isLineupReady = () => {
    if (loading) return true; // Keep true during loading so we don't flash "not ready" message
    if (!homePlayers || homePlayers.length === 0) return false;
    return true;
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !userId) return;

    const msgText = chatInput.trim();
    setChatInput(""); // snappy UI clear

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage = {
      id: tempId,
      playerId: null,
      playerName: "",
      rantKey: msgText,
      userId,
      userName: userProfile?.name || 'تماشاگر ناشناس',
      userAvatar: userProfile?.avatar || '',
      timestamp: Date.now()
    };

    setRantHistory(prev => [...prev, tempMessage]);

    try {
      await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId,
          playerId: null,
          playerName: "",
          playerPhoto: "",
          teamId: "",
          teamName: "",
          teamCrest: "",
          rantKey: msgText,
          userId,
          userName: userProfile?.name || 'تماشاگر ناشناس',
          userAvatar: userProfile?.avatar || ''
        }),
      });
    } catch (err) {
      console.error("Failed to send chat message:", err);
    }
  };

  const triggerEmojiRain = () => {
    const now = Date.now();
    if (now - lastRainTime.current < 30000) return; // 30s global cooldown
    lastRainTime.current = now;

    const newRain = Array.from({ length: 30 }).map((_, i) => ({
      id: now + i + Math.random(),
      char: Math.random() > 0.5 ? '💩' : '🍅',
      left: `${Math.random() * 100}vw`,
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 3}s`,
      scale: 0.5 + Math.random() * 1.5
    }));
    setRainElements(newRain);
    setTimeout(() => {
      setRainElements([]);
    }, 6000);
  };

  // Calculate the player with the highest totalRants in the match
  const allPlayers = [
    ...homePlayers,
    ...awayPlayers,
    ...homeBench,
    ...awayBench,
  ];
  const maxRants = allPlayers.reduce(
    (max, p) => (p.totalRants > max ? p.totalRants : max),
    0,
  );

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const lightboxRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (matchTab === 'history') {
      scrollToBottom();
      const timeoutId = setTimeout(scrollToBottom, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [matchTab, rantHistory]);

  useEffect(() => {
    const dialogEl = lightboxRef.current;
    if (!dialogEl) return;
    if (lightboxPhoto) {
      if (!dialogEl.open) {
        dialogEl.showModal();
      }
    } else {
      if (dialogEl.open) {
        dialogEl.close();
      }
    }
  }, [lightboxPhoto]);

  // Sync selectedPlayer details if they update in the background (like photoUrl or rants)
  useEffect(() => {
    if (selectedPlayer) {
      const allPlayers = [
        ...homePlayers,
        ...awayPlayers,
        ...homeBench,
        ...awayBench,
      ];
      const match = allPlayers.find((p) => p.id === selectedPlayer.id);
      if (
        match &&
        (match.photoUrl !== selectedPlayer.photoUrl ||
          match.totalRants !== selectedPlayer.totalRants)
      ) {
        setSelectedPlayer(match);
      }
    }
  }, [homePlayers, awayPlayers, homeBench, awayBench, selectedPlayer]);

  // Load player photos incrementally in chunks to avoid API rate limits
  const loadPlayerPhotos = async (players, setPlayers) => {
    const playersCopy = [...players];
    const chunkSize = 4;

    for (let i = 0; i < playersCopy.length; i += chunkSize) {
      const chunk = playersCopy.slice(i, i + chunkSize);
      const updatedChunk = await Promise.all(
        chunk.map(async (player) => {
          const photoUrl = await fetchPlayerPhoto(player.name);
          return { ...player, photoUrl };
        }),
      );

      setPlayers((prev) =>
        prev.map((p) => {
          const updated = updatedChunk.find((uc) => uc.id === p.id);
          return updated ? { ...p, photoUrl: updated.photoUrl } : p;
        }),
      );

      if (i + chunkSize < playersCopy.length) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  };

  // Position names in Persian
  const getPersianPositionAbbr = (pos) => {
    switch (pos?.toUpperCase()) {
      case "GOALKEEPER":
        return "دروازه‌بان";
      case "DEFENDER":
        return "مدافع";
      case "MIDFIELDER":
        return "هافبک";
      case "FORWARD":
        return "مهاجم";
      default:
        return "بازیکن";
    }
  };

  const getPositionColor = (pos) => {
    switch (pos?.toUpperCase()) {
      case "GOALKEEPER":
        return "var(--color-gk)";
      case "DEFENDER":
        return "var(--color-def)";
      case "MIDFIELDER":
        return "var(--color-mid)";
      case "FORWARD":
        return "var(--color-fwd)";
      default:
        return "var(--hint-color)";
    }
  };

  const mapTeamRoster = (lineup, side) => {
    const sorted = sortPlayers(lineup);
    return sorted.map((p) => ({
      ...p,
      side,
      totalRants: p.totalRants || 0,
      rants: PREDEFINED_RANTS.reduce((acc, curr) => {
        acc[curr.key] = p.rants?.[curr.key] || 0;
        return acc;
      }, {}),
    }));
  };

  const simulateRoster = (
    starters,
    bench,
    side,
    homeTeamName,
    awayTeamName,
    matchScore,
    matchMinutes,
    status,
  ) => {
    const isHome = side === "home";
    const teamScore = isHome ? matchScore.home : matchScore.away;
    const isLiveOrFinished = status === "LIVE" || status === "FINISHED";

    // 1. Determine which bench players are subbed in
    const updatedBench = bench.map((p, idx) => {
      let subbedInMin = null;
      if (isLiveOrFinished) {
        if (p.name.includes("Undav") || p.name.includes("دنیز اونداو")) {
          subbedInMin = 72;
        } else if (idx === 0) {
          subbedInMin = 60;
        } else if (idx === 1) {
          subbedInMin = 75;
        } else if (idx === 2) {
          subbedInMin = 82;
        }
      }

      if (subbedInMin && matchMinutes >= subbedInMin) {
        return {
          ...p,
          subbedIn: subbedInMin,
          subbedOut: null,
          minutesPlayed: Math.max(0, matchMinutes - subbedInMin),
          baseRating: 6.5,
          goals: 0,
          assists: 0,
          shots: 0,
          yellowCards: 0,
          redCards: 0,
        };
      } else {
        return {
          ...p,
          subbedIn: null,
          subbedOut: null,
          minutesPlayed: 0,
          baseRating: null,
          goals: 0,
          assists: 0,
          shots: 0,
          yellowCards: 0,
          redCards: 0,
        };
      }
    });

    // 2. Map starters and determine if they were subbed out
    const updatedStarters = starters.map((p, idx) => {
      let subbedOutMin = null;
      if (isLiveOrFinished) {
        if (
          idx === 8 &&
          matchMinutes >= 60 &&
          updatedBench.some((b) => b.subbedIn === 60)
        ) {
          subbedOutMin = 60;
        } else if (
          idx === 9 &&
          matchMinutes >= 72 &&
          updatedBench.some((b) => b.subbedIn === 72)
        ) {
          subbedOutMin = 72;
        } else if (
          idx === 9 &&
          matchMinutes >= 75 &&
          updatedBench.some((b) => b.subbedIn === 75)
        ) {
          subbedOutMin = 75;
        } else if (
          idx === 10 &&
          matchMinutes >= 82 &&
          updatedBench.some((b) => b.subbedIn === 82)
        ) {
          subbedOutMin = 82;
        }
      }

      const minutesPlayed = subbedOutMin
        ? subbedOutMin
        : isLiveOrFinished
          ? matchMinutes
          : 0;

      return {
        ...p,
        subbedIn: null,
        subbedOut: subbedOutMin,
        minutesPlayed,
        baseRating: isLiveOrFinished ? 7.5 : null,
        goals: 0,
        assists: 0,
        shots: 0,
        yellowCards: 0,
        redCards: 0,
      };
    });

    // 3. Distribute goals based on matchScore
    const isGermanyMatch =
      (homeTeamName === "Germany" && awayTeamName === "Curaçao") ||
      (homeTeamName === "Curaçao" && awayTeamName === "Germany");

    const allPlayers = [...updatedStarters, ...updatedBench].filter(
      (p) => p.minutesPlayed > 0,
    );

    if (isLiveOrFinished && teamScore > 0) {
      if (isGermanyMatch) {
        const isGermanyTeam =
          (isHome && homeTeamName === "Germany") ||
          (!isHome && awayTeamName === "Germany");
        if (isGermanyTeam) {
          let goalsAssigned = 0;
          const targetScorers = [
            { name: "Havertz", max: 2 },
            { name: "Musiala", max: 2 },
            { name: "Nmecha", max: 1 },
            { name: "Undav", max: 1 },
          ];

          for (const target of targetScorers) {
            const found = allPlayers.find((p) => p.name.includes(target.name));
            if (found) {
              const goalsToAssign = Math.min(
                target.max,
                teamScore - goalsAssigned,
              );
              found.goals = goalsToAssign;
              goalsAssigned += goalsToAssign;
            }
          }

          let remainingGoals = teamScore - goalsAssigned;
          if (remainingGoals > 0) {
            const potentialScorers = allPlayers.filter(
              (p) => p.position === "FORWARD" || p.position === "MIDFIELDER",
            );
            for (let i = 0; i < remainingGoals; i++) {
              const scorer = potentialScorers[i % potentialScorers.length];
              if (scorer) scorer.goals += 1;
            }
          }
        } else {
          const locadia = allPlayers.find((p) => p.name.includes("Locadia"));
          if (locadia) {
            locadia.goals = teamScore;
          } else {
            const forward =
              allPlayers.find((p) => p.position === "FORWARD") || allPlayers[0];
            if (forward) forward.goals = teamScore;
          }
        }
      } else {
        const forwards = allPlayers.filter((p) => p.position === "FORWARD");
        const midfielders = allPlayers.filter(
          (p) => p.position === "MIDFIELDER",
        );
        const candidates = [...forwards, ...midfielders];

        if (candidates.length > 0) {
          for (let i = 0; i < teamScore; i++) {
            const player = candidates[i % candidates.length];
            player.goals += 1;
          }
        } else if (allPlayers.length > 0) {
          allPlayers[0].goals = teamScore;
        }
      }
    }

    // 4. Distribute Assists
    if (isLiveOrFinished && teamScore > 0) {
      const goalsList = [];
      allPlayers.forEach((p) => {
        for (let i = 0; i < p.goals; i++) {
          goalsList.push(p.id);
        }
      });

      const potentialAssisters = allPlayers.filter(
        (p) => p.position !== "GOALKEEPER",
      );
      let assisterIdx = 0;
      goalsList.forEach((goalPlayerId, idx) => {
        if (idx % 3 !== 2 && potentialAssisters.length > 1) {
          const assister =
            potentialAssisters.find((p) => p.id !== goalPlayerId) ||
            potentialAssisters[assisterIdx % potentialAssisters.length];
          if (assister) {
            assister.assists += 1;
            assisterIdx++;
          }
        }
      });
    }

    // 5. Simulate Shots, Yellow cards, Red cards
    allPlayers.forEach((p) => {
      if (p.position === "FORWARD") {
        p.shots = Math.max(p.goals, 2 + (p.id.toString().charCodeAt(0) % 4));
      } else if (p.position === "MIDFIELDER") {
        p.shots = Math.max(p.goals, 1 + (p.id.toString().charCodeAt(0) % 3));
      } else if (p.position === "DEFENDER") {
        p.shots = Math.max(p.goals, p.id.toString().charCodeAt(0) % 2);
      } else {
        p.shots = 0;
      }

      const nameSeed =
        p.name.charCodeAt(0) + p.name.charCodeAt(p.name.length - 1);
      if (p.position !== "GOALKEEPER" && nameSeed % 7 === 0) {
        p.yellowCards = 1;
      } else {
        p.yellowCards = 0;
      }
      p.redCards = 0;
    });

    return {
      starters: updatedStarters,
      bench: updatedBench,
    };
  };

  const renderRatingBadge = (rating) => {
    if (rating === undefined || rating === null) return null;
    const val = parseFloat(rating);
    let bg = "var(--rating-color-green)";
    let color = "#ffffff";
    if (val < 5.0) {
      bg = "var(--rating-color-red)";
    } else if (val < 6.0) {
      bg = "var(--rating-color-yellow)";
      color = "#121314";
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          backgroundColor: bg,
          color: color,
          fontSize: "0.675rem",
          fontWeight: "900",
          fontFamily: "var(--font-family-en)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
          flexShrink: 0,
        }}
      >
        {val.toFixed(1)}
      </span>
    );
  };

  // Handle real API fetch automatically on mount or when token is set
  useEffect(() => {
    if (authToken && matchId) {
      handleFetchRealMatch();
    }
  }, [authToken, matchId]);

  // Live polling sync for real-time player rants updates
  useEffect(() => {
    if (!matchId || matchStatus !== "LIVE") return;

    let lastTimestamp = 0;
    let isMounted = true;

    console.log(`[Client] Starting live updates polling for match: ${matchId}`);

    const pollLiveUpdates = async () => {
      if (matchStatus !== "LIVE") return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      try {
        const res = await fetch(`/api/live?matchId=${matchId}&since=${lastTimestamp}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.newRants && data.newRants.length > 0) {
          // Check for spikes (10+ rants for a player in the new batch)
          const counts = {};
          data.newRants.forEach(r => {
            counts[r.playerId] = (counts[r.playerId] || 0) + 1;
          });
          const hasSpike = Object.values(counts).some(c => c >= 10);
          if (hasSpike && lastTimestamp > 0) {
            triggerEmojiRain();
          }

          // Update rant history feed
          setRantHistory(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const filteredNew = data.newRants.filter(r => !existingIds.has(r.id));
            const combined = [...prev, ...filteredNew];
            return combined.slice(-100);
          });

          // Keep a set of processed player IDs to clear their activeRants after 2 seconds
          const playersToClear = new Set();

          data.newRants.forEach((newRant) => {
            const { playerId, rantKey } = newRant;
            const playerStats = data.rants?.[playerId];
            if (!playerStats) return;

            const totalRants = playerStats.totalRants || 0;
            const rants = playerStats.rants || {};

            // Resolve Persian text of the rant
            const rantPersian =
              PREDEFINED_RANTS.find((r) => r.key === rantKey)?.persianText || "";

            const updateRants = (prevList) => {
              return prevList.map((p) => {
                if (p.id === playerId) {
                  const updated = {
                    ...p,
                    totalRants,
                    rants,
                    activeRant: rantPersian,
                  };
                  if (p.baseRating) {
                    updated.rating = Math.max(
                      1.0,
                      parseFloat((p.baseRating - totalRants * 0.2).toFixed(1)),
                    );
                  }
                  return updated;
                }
                return p;
              });
            };

            setHomePlayers(updateRants);
            setAwayPlayers(updateRants);
            setHomeBench(updateRants);
            setAwayBench(updateRants);

            playersToClear.add(playerId);
          });

          // After 2 seconds, clear the activeRants for the players that had updates
          setTimeout(() => {
            if (!isMounted) return;
            const clearRant = (prevList) => {
              return prevList.map((p) => {
                if (playersToClear.has(p.id)) {
                  return { ...p, activeRant: null };
                }
                return p;
              });
            };
            setHomePlayers(clearRant);
            setAwayPlayers(clearRant);
            setHomeBench(clearRant);
            setAwayBench(clearRant);
          }, 2000);
        }

        if (data.timestamp) {
          lastTimestamp = data.timestamp;
        }
      } catch (err) {
        console.error("[Client] Failed to poll live updates:", err);
      }
    };

    // Poll every 10 seconds
    const interval = setInterval(pollLiveUpdates, 10000);

    // Initial fetch to establish lastTimestamp
    pollLiveUpdates();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [matchId, matchStatus]);

  // Update match minutes locally every minute when live
  useEffect(() => {
    let interval = null;
    if (matchStatus === "LIVE") {
      interval = setInterval(() => {
        setMatchMinutes((prev) => {
          if (typeof prev === "string") {
            if (/HT|Half/i.test(prev) || prev === "بین نیمه") {
              return prev;
            }
            if (prev.includes("+")) {
              const parts = prev.split("+");
              const base = parseInt(parts[0]) || 0;
              const extra = parseInt(parts[1]) || 0;
              if (base + extra >= 120) {
                clearInterval(interval);
                setMatchStatus("FINISHED");
                return "120";
              }
              return `${base}+${extra + 1}`;
            }
            const numeric = parseInt(prev) || 0;
            if (numeric >= 90) {
              clearInterval(interval);
              setMatchStatus("FINISHED");
              return "90";
            }
            return String(numeric + 1);
          }
          if (prev >= 90) {
            clearInterval(interval);
            setMatchStatus("FINISHED");
            return 90;
          }
          return prev + 1;
        });
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [matchStatus]);

  // Auto-refresh match details from the API every 30 seconds when live
  useEffect(() => {
    let interval = null;
    if (matchStatus === "LIVE" && authToken && matchId) {
      interval = setInterval(() => {
        handleFetchRealMatch();
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [matchStatus, authToken, matchId]);

  // Fetch real WC matches and their squads
  const handleFetchRealMatch = async () => {
    if (!matchId) return;
    setLoading(true);
    setApiError(null);
    try {
      const fetchUrl = `/api/match`;
      console.log(
        `[Client] Fetching match details from: ${fetchUrl} (ID: ${matchId})`,
      );
      const res = await fetch(fetchUrl, {
        headers: {
          "x-match-id": matchId,
        },
      });
      console.log(`[Client] Response status: ${res.status}, ok: ${res.ok}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[Client] Server returned error response:`, errorData);
        throw new Error(
          `خطای سرور (${res.status}): ${errorData.message || "پاسخی دریافت نشد"}`,
        );
      }

      const selectedMatch = await res.json();
      console.log(`[Client] Parsed response data:`, selectedMatch);

      if (
        !selectedMatch ||
        !selectedMatch.homeTeam ||
        !selectedMatch.awayTeam ||
        !selectedMatch.score
      ) {
        console.warn(
          `[Client] Validation failed for match data structure. SelectedMatch key check:`,
          {
            hasMatch: !!selectedMatch,
            hasHomeTeam: !!selectedMatch?.homeTeam,
            hasAwayTeam: !!selectedMatch?.awayTeam,
            hasScore: !!selectedMatch?.score,
          },
        );
        throw new Error(
          "اطلاعات بازی نامعتبر است یا در حال حاضر در دسترس نیست",
        );
      }

      // Convert team names to Persian
      const persianHomeName = getPersianTeamName(selectedMatch.homeTeam.name);
      const persianAwayName = getPersianTeamName(selectedMatch.awayTeam.name);

      setHomeTeam({
        id: selectedMatch.homeTeam.id,
        name: persianHomeName,
        crest: selectedMatch.homeTeam.crest,
      });
      setAwayTeam({
        id: selectedMatch.awayTeam.id,
        name: persianAwayName,
        crest: selectedMatch.awayTeam.crest,
      });

      setMatchScore({
        home: selectedMatch.score.home,
        away: selectedMatch.score.away,
      });

      const isLive = selectedMatch.status === "LIVE";
      const isFinished = selectedMatch.status === "FINISHED";
      const statusStr = isLive ? "LIVE" : isFinished ? "FINISHED" : "WAITING";
      const elapsedMin = isLive
        ? selectedMatch.elapsed || 1
        : isFinished
          ? 90
          : 0;

      // Update match status and set match minutes/kickoff info
      if (isLive) {
        setMatchStatus("LIVE");
        setMatchMinutes(selectedMatch.displayClock || elapsedMin);
      } else if (isFinished) {
        setMatchStatus("FINISHED");
        setMatchMinutes(90);
      } else {
        setMatchStatus("WAITING");
        setMatchMinutes(0);
        setWaitingCountdown(selectedMatch.utcDate);
      }
      setUtcDate(selectedMatch.utcDate);

      // Map lineup players
      let homeLineup = selectedMatch.homeTeam.lineup || [];
      let awayLineup = selectedMatch.awayTeam.lineup || [];
      let homeBenchList = selectedMatch.homeTeam.bench || [];
      let awayBenchList = selectedMatch.awayTeam.bench || [];



      const mappedHome = mapTeamRoster(homeLineup, "home");
      const mappedAway = mapTeamRoster(awayLineup, "away");
      const mappedHomeBench = mapTeamRoster(homeBenchList, "home");
      const mappedAwayBench = mapTeamRoster(awayBenchList, "away");

      // Run simulation
      const simulatedHome = simulateRoster(
        mappedHome,
        mappedHomeBench,
        "home",
        selectedMatch.homeTeam.name,
        selectedMatch.awayTeam.name,
        selectedMatch.score,
        elapsedMin,
        statusStr,
      );

      const simulatedAway = simulateRoster(
        mappedAway,
        mappedAwayBench,
        "away",
        selectedMatch.homeTeam.name,
        selectedMatch.awayTeam.name,
        selectedMatch.score,
        elapsedMin,
        statusStr,
      );

      const homeStarters = simulatedHome.starters.map((p) => ({
        ...p,
        rating: p.baseRating
          ? Math.max(
              1.0,
              parseFloat((p.baseRating - (p.totalRants || 0) * 0.2).toFixed(1)),
            )
          : p.baseRating,
      }));
      const homeSubs = simulatedHome.bench.map((p) => ({
        ...p,
        rating: p.baseRating
          ? Math.max(
              1.0,
              parseFloat((p.baseRating - (p.totalRants || 0) * 0.2).toFixed(1)),
            )
          : p.baseRating,
      }));
      const awayStarters = simulatedAway.starters.map((p) => ({
        ...p,
        rating: p.baseRating
          ? Math.max(
              1.0,
              parseFloat((p.baseRating - (p.totalRants || 0) * 0.2).toFixed(1)),
            )
          : p.baseRating,
      }));
      const awaySubs = simulatedAway.bench.map((p) => ({
        ...p,
        rating: p.baseRating
          ? Math.max(
              1.0,
              parseFloat((p.baseRating - (p.totalRants || 0) * 0.2).toFixed(1)),
            )
          : p.baseRating,
      }));

      setHomePlayers(homeStarters);
      setHomeBench(homeSubs);
      setAwayPlayers(awayStarters);
      setAwayBench(awaySubs);

      loadPlayerPhotos(homeStarters, setHomePlayers);
      loadPlayerPhotos(awayStarters, setAwayPlayers);
      loadPlayerPhotos(homeSubs, setHomeBench);
      loadPlayerPhotos(awaySubs, setAwayBench);
    } catch (err) {
      console.error(`[Client] Error in handleFetchRealMatch:`, err);
      setApiError(err.message);
      // Fallback
      setHomeTeam({ name: "خطا در اتصال", crest: "" });
      setAwayTeam({ name: "خطا در اتصال", crest: "" });
      setHomePlayers([]);
      setAwayPlayers([]);
      setHomeBench([]);
      setAwayBench([]);
    } finally {
      setLoading(false);
    }
  };

  const addFloatingBall = (clientX, clientY) => {
    const id = Date.now() + Math.random();
    setFloatingBalls((prev) => [...prev, { id, x: clientX, y: clientY }]);
    setTimeout(() => {
      setFloatingBalls((prev) => prev.filter((ball) => ball.id !== id));
    }, 750);
  };

  const handleRant = (playerId, rantKey, event) => {
    if (matchStatus === "FINISHED" || matchStatus === "WAITING") return;

    if (event && event.clientX && event.clientY) {
      addFloatingBall(event.clientX, event.clientY);
    }

    const allPlayersList = [
      ...homePlayers,
      ...awayPlayers,
      ...homeBench,
      ...awayBench,
    ];
    const player = allPlayersList.find((p) => p.id === playerId);
    if (!player) return;

    const teamId = player.side === "home" ? homeTeam.id : awayTeam.id;
    const teamName = player.side === "home" ? homeTeam.name : awayTeam.name;
    const teamCrest = player.side === "home" ? homeTeam.crest : awayTeam.crest;

    const isHome = player.side === "home";
    const isInStarting =
      homePlayers.some((p) => p.id === playerId) ||
      awayPlayers.some((p) => p.id === playerId);
    const setList = isInStarting
      ? isHome
        ? setHomePlayers
        : setAwayPlayers
      : isHome
        ? setHomeBench
        : setAwayBench;

    const rantPersian =
      PREDEFINED_RANTS.find((r) => r.key === rantKey)?.persianText || "";

    setList((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          const newRants = {
            ...p.rants,
            [rantKey]: (p.rants[rantKey] || 0) + 1,
          };
          const newTotal = p.totalRants + 1;
          const updated = {
            ...p,
            rants: newRants,
            totalRants: newTotal,
            activeRant: rantPersian,
          };

          if (p.baseRating) {
            updated.rating = Math.max(
              1.0,
              parseFloat((p.baseRating - newTotal * 0.2).toFixed(1)),
            );
          }

          if (selectedPlayer && selectedPlayer.id === playerId) {
            setSelectedPlayer(updated);
          }
          return updated;
        }
        return p;
      }),
    );

    // Clear temporary active rant after 2 seconds
    setTimeout(() => {
      setList((prev) =>
        prev.map((p) => {
          if (p.id === playerId) {
            return { ...p, activeRant: null };
          }
          return p;
        }),
      );
    }, 2000);

    // Submit the rant to the backend persistent store
    fetch("/api/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matchId,
        playerId,
        playerName: player.name,
        playerPhoto: player.photoUrl,
        teamId,
        teamName,
        teamCrest,
        rantKey,
        userId,
        userName: userProfile?.name || 'تماشاگر ناشناس',
        userAvatar: userProfile?.avatar || ''
      }),
    })
      .then((res) => res.json())
      .catch((err) => console.error("Failed to post rant:", err));

    // Close the bottom sheet modal dialog
    setIsModalOpen(false);
    setSelectedPlayer(null);

    // Show toast notification
    setToastMessage("ثبت شد");
  };

  const getLeaderboard = () => {
    const all = [...homePlayers, ...awayPlayers, ...homeBench, ...awayBench];
    return all
      .filter((p) => p.totalRants > 0)
      .sort((a, b) => b.totalRants - a.totalRants)
      .slice(0, 3);
  };

  const getRantKing = () => {
    const all = [...homePlayers, ...awayPlayers, ...homeBench, ...awayBench];
    if (all.length === 0) return null;
    const sorted = all.sort((a, b) => b.totalRants - a.totalRants);
    return sorted[0].totalRants > 0 ? sorted[0] : null;
  };

  const getRantKingSummary = (king) => {
    if (!king) return "بازی آرامی بود و تماشاچیان اعتراض زیادی را ابراز نکردند!";

    let topRantKey = "";
    let maxRantVal = -1;
    Object.entries(king.rants || {}).forEach(([key, val]) => {
      if (val > maxRantVal) {
        maxRantVal = val;
        topRantKey = key;
      }
    });

    const topRantText =
      PREDEFINED_RANTS.find((r) => r.key === topRantKey)?.persianText ||
      "پاس بده دیگه! ⚽";
    const teamName = king.side === "home" ? homeTeam.name : awayTeam.name;

    const jokes = [
      `امروز جناب «${king.name}» بازیکن تیم ${teamName} ثابت کرد که حتی اگر کاری هم نکند، روی مخ راه رفتن تخصص اوست! او با ثبت ${king.totalRants} بار هو شدن، بنجل‌ترین بازیکن مسابقه لقب گرفت. بیشترین هو: «${topRantText}»!`,
      `خسته نباشی قهرمان! جناب «${king.name}» از تیم ${teamName} با ${king.totalRants} بار هو شدن، رسماً روح و روان تماشاگران را به کما برد! ملت شاکی‌اند که چرا مدام «${topRantText}»!`,
      `عنوان بنجل مسابقه امروز جام جهانی ۲۰۲۶ به سر «${king.name}» (${teamName}) نشست! او با کسب ${king.totalRants} بار هو شدن، تمام رقبا را خاکستر کرد. بیشترین هو: «${topRantText}».`,
    ];

    return jokes[king.id % jokes.length];
  };

  const renderPlayerRow = (player) => {
    const lastName = player.name.split(" ").slice(-1)[0] || player.name;
    const isHome = player.side === "home";
    const posColor = getPositionColor(player.position);
    const hasMostRants = maxRants > 0 && player.totalRants === maxRants;
    return (
      <div
        key={player.id}
        onClick={() => {
          setSelectedPlayer(player);
          setIsModalOpen(true);
        }}
        className={`native-player-row ${isHome ? "home-row" : "away-row"}`}
        style={{
          opacity:
            player.subbedIn === null && player.minutesPlayed === 0 ? 0.65 : 1,
          borderRight: isHome ? `3px solid ${posColor}` : undefined,
          borderLeft: !isHome ? `3px solid ${posColor}` : undefined,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        <div className="player-row-right">
          <div 
            className="native-player-avatar-container"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              const photoUrl = player.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${isHome ? "00e676" : "ff3e3e"}`;
              setLightboxPhoto({ url: photoUrl, name: player.name });
            }}
          >
            <img
              src={
                player.photoUrl ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${isHome ? "00e676" : "ff3e3e"}`
              }
              alt={player.name}
              className="native-player-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${isHome ? "00e676" : "ff3e3e"}`;
              }}
            />
            <span className="native-player-number-chip">
              {player.shirtNumber}
            </span>
          </div>
          <div
            className="native-player-name-wrapper"
            style={{
              height: "36px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              className="native-player-name"
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              {lastName}
              {player.subbedOut && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-danger)",
                    fontWeight: "800",
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  title="تعویض خارج"
                >
                  ↓
                </span>
              )}
              {player.subbedIn && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-primary)",
                    fontWeight: "800",
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  title="تعویض داخل"
                >
                  ↑
                </span>
              )}
              <span
                className="native-player-rants-count-inline"
                style={{
                  fontSize: "0.65rem",
                  color:
                    player.totalRants > 0
                      ? "var(--color-danger)"
                      : "var(--text-hint)",
                  marginRight: "4px",
                  fontWeight: "500",
                }}
              >
                ({player.totalRants})
              </span>
              </span>
            <span
              className={`active-rant-bubble ${player.activeRant ? "active" : ""}`}
            >
              {player.activeRant || "\u00a0"}
            </span>
          </div>
        </div>

        <div className="player-row-left">
          {hasMostRants && (
            <span
              className="poop-sticker-badge"
              style={{
                fontSize: "1.4rem",
                marginRight: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="بیشترین هو مسابقه"
            >
              💩
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderTeamRoster = (starters, bench) => {
    return (
      <div className="native-roster-list">
        <h3 className="native-section-title">ترکیب اصلی</h3>
        <div className="native-players-group">
          {starters.map(renderPlayerRow)}
        </div>

        {bench.length > 0 && (
          <>
            <h3 className="native-section-title" style={{ marginTop: "16px" }}>
              بازیکنان ذخیره
            </h3>
            <div className="native-players-group">
              {bench.map(renderPlayerRow)}
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading && !homePlayers.length) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "300px",
          gap: "12px",
        }}
      >
        <div
          className="blink"
          style={{
            fontSize: "1rem",
            fontWeight: "900",
            color: "var(--md-sys-color-on-background)",
          }}
        >
          در حال ارتباط با استادیوم...
        </div>
      </div>
    );
  }

  return (
    <div className="match-zone-container">
      {/* Falling Emoji Rain */}
      {rainElements.map(emoji => (
        <span 
          key={emoji.id}
          className="falling-emoji-rain"
          style={{
            left: emoji.left,
            animationDelay: emoji.delay,
            animationDuration: emoji.duration,
            transform: `scale(${emoji.scale})` 
          }}
        >
          {emoji.char}
        </span>
      ))}

      {/* Floating Micro-Animations */}
      {floatingBalls.map((ball) => (
        <span
          key={ball.id}
          className="floating-ball-animation"
          style={{ left: ball.x, top: ball.y }}
        >
          ⚽
        </span>
      ))}

      {apiError && (
        <div
          className="settings-error"
          style={{ margin: "8px auto", width: "100%", textAlign: "center" }}
        >
          ⚠️ {apiError}
        </div>
      )}

      {/* DASHBOARD AND POST-MATCH SUMMARY */}
      <>
        {/* Native Scoreboard Banner */}
        <div className="native-scoreboard">
          <div className="native-scoreboard-row">
            {/* Home Team */}
            <div className="native-scoreboard-team home">
              {renderCrest(
                homeTeam.crest || getTeamFlag(homeTeam.name),
                homeTeam.name,
                "native-scoreboard-crest",
              )}
              <span className="native-scoreboard-team-name">
                {homeTeam.name}
              </span>
            </div>

            {/* Score */}
            <div className="native-scoreboard-score">
              <span>{matchScore.home}</span>
              <span className="native-score-separator">-</span>
              <span>{matchScore.away}</span>
            </div>

            {/* Away Team */}
            <div className="native-scoreboard-team away">
              <span className="native-scoreboard-team-name">
                {awayTeam.name}
              </span>
              {renderCrest(
                awayTeam.crest || getTeamFlag(awayTeam.name),
                awayTeam.name,
                "native-scoreboard-crest",
              )}
            </div>
          </div>

          {/* Below: Minute */}
          <div
            className={`native-scoreboard-status ${matchStatus === "LIVE" ? "live" : ""}`}
          >
            {matchStatus === "LIVE"
              ? (matchMinutes === "HT" || matchMinutes === "بین نیمه" || /HT/i.test(String(matchMinutes)))
                ? "بین نیمه"
                : `دقیقه ${matchMinutes}'`
              : matchStatus === "WAITING"
                ? "شروع نشده"
                : "پایان مسابقه"}
          </div>
        </div>

        {/* Conditional Tab Rendering */}
        {matchTab === 'lineup' ? (
          !isLineupReady() ? (
            <div className="lineup-not-ready-container" style={{ padding: '40px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--color-bg)', minHeight: '300px' }}>
              <span style={{ fontSize: '3rem' }}>⏳</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>هنوز لیست رسمی اعلام نشده است</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: '1.6' }}>
                بنجلا منتظرن ببینن کی میره تو زمین! 🏟️
                <br />
                (معمولاً ۱ ساعت قبل از شروع بازی ترکیب نهایی اعلام میشه)
              </p>
            </div>
          ) : (
            <div className="native-roster-columns" style={{ paddingBottom: '74px' }}>
              {/* Right Column: Home Team */}
              <div className="native-roster-column">
                {renderTeamRoster(homePlayers, homeBench)}
              </div>

              {/* Left Column: Away Team */}
              <div className="native-roster-column">
                {renderTeamRoster(awayPlayers, awayBench)}
              </div>
            </div>
          )
        ) : (
          <div ref={chatContainerRef} className="rant-history-feed-container" style={{ paddingBottom: '130px' }}>
            {rantHistory.length > 0 ? (
              <div className="rant-history-list">
                {rantHistory.map((rant) => {
                  const defaultEmojis = ['⚽', '🏆', '💩', '🤡', '👑', '🏃‍♂️', '🧤', '🍔', '🍺', '🦖'];
                  const isEmoji = rant.userAvatar && defaultEmojis.includes(rant.userAvatar);
                  const rantText = PREDEFINED_RANTS.find(r => r.key === rant.rantKey)?.persianText || rant.rantKey;
                  const isMyMessage = rant.userId === userId;
                  
                  return (
                    <div key={rant.id} className={`rant-feed-item ${isMyMessage ? 'my-message' : ''}`}>
                      <div className="rant-feed-avatar-wrapper">
                        {!rant.userAvatar ? (
                          <div className="rant-feed-avatar initials">{rant.userName ? rant.userName.trim().charAt(0) : '👤'}</div>
                        ) : isEmoji ? (
                          <div className="rant-feed-avatar emoji">{rant.userAvatar}</div>
                        ) : (
                          <img src={rant.userAvatar} alt="User" className="rant-feed-avatar" onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=placeholder';
                          }} />
                        )}
                      </div>
                      <div className="rant-feed-content">
                        <div className="rant-feed-meta">
                          <span className="rant-feed-username">{rant.userName}</span>
                          <span className="rant-feed-time">{new Date(rant.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="rant-feed-bubble">
                          <div className="rant-feed-body">
                            {rant.playerName ? (
                              <>
                                به <strong style={{ color: 'var(--color-danger)' }}>{rant.playerName}</strong> غر زد: «<span className="rant-feed-text">{rantText}</span>»
                              </>
                            ) : (
                              <span className="rant-feed-text">{rantText}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rant-history-empty">
                <span>💬</span>
                <p>هنوز هیچ پیامی برای این بازی ثبت نشده است.</p>
                {matchStatus === "LIVE" && <p className="blink-soft">اولین نفر باشید که پیام ارسال می‌کند!</p>}
              </div>
            )}
          </div>
        )}

        {/* Chat input bar rendered when Chat is active */}
        {matchTab === 'history' && (
          <div className="chat-input-bar">
            <input 
              type="text" 
              placeholder="ارسال پیام به استادیوم..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChatMessage();
              }}
              maxLength={100}
            />
            <button onClick={handleSendChatMessage} disabled={!chatInput.trim()} aria-label="ارسال">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        )}
      </>

      {/* Rant Bottom Sheet Modal */}
      <RantDialog
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPlayer(null);
        }}
        player={selectedPlayer}
        onRant={handleRant}
        predefinedRants={PREDEFINED_RANTS}
        isMatchFinished={matchStatus === "FINISHED"}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        matchScore={matchScore}
        matchMinutes={matchMinutes}
        matchStatus={matchStatus}
        onShowLightbox={(photoUrl, name) => setLightboxPhoto({ url: photoUrl, name })}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="native-toast">
          <span className="native-toast-icon">✅</span>
          <span className="native-toast-message">{toastMessage}</span>
        </div>
      )}

      {/* Lightbox photo preview (native dialog top layer overlay) */}
      <dialog
        ref={lightboxRef}
        className="lightbox-dialog"
        onCancel={(e) => {
          e.preventDefault();
          setLightboxPhoto(null);
        }}
        onClick={() => setLightboxPhoto(null)}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            boxSizing: "border-box",
            padding: "16px",
          }}
        >
          {lightboxPhoto && (
            <>
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                style={{
                  maxWidth: "85%",
                  maxHeight: "75%",
                  objectFit: "contain",
                  borderRadius: "16px",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span
                style={{
                  marginTop: "16px",
                  color: "#ffffff",
                  fontSize: "1.05rem",
                  fontWeight: "800",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                }}
              >
                {lightboxPhoto.name}
              </span>
            </>
          )}
        </div>
      </dialog>

      {/* Fixed bottom navigation tabs inside MatchZone */}
      <nav className="native-bottom-nav">
        <button
          onClick={() => setMatchTab('lineup')}
          className={`native-nav-item ${matchTab === 'lineup' ? 'active' : ''}`}
        >
          <span className="nav-item-icon">📋</span>
          <span className="nav-item-label">ترکیب تیم‌ها</span>
        </button>
        <button
          onClick={() => setMatchTab('history')}
          className={`native-nav-item ${matchTab === 'history' ? 'active' : ''}`}
        >
          <span className="nav-item-icon">💬</span>
          <span className="nav-item-label">چت</span>
        </button>
      </nav>
    </div>
  );
}
