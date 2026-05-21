const CACHE = new Map();
const CACHE_TTL = 20 * 60 * 1000;

async function espnGet(url) {
  const hit = CACHE.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();
  CACHE.set(url, { data, ts: Date.now() });
  return data;
}

function espnBase(league) {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}`;
}

function normalizePos(abbr) {
  switch ((abbr ?? '').toUpperCase()) {
    case 'GK':                                   return 'GK';
    case 'CB': case 'RB': case 'LB':
    case 'LWB': case 'RWB': case 'SW':           return 'DEF';
    case 'CDM': case 'DM': case 'CM':
    case 'RM': case 'LM':                        return 'MID';
    case 'CAM': case 'AM':                       return 'MID';
    case 'RW': case 'LW': case 'CF':
    case 'ST': case 'SS': case 'FW':             return 'FWD';
    default:                                     return abbr ?? '';
  }
}

function currentSeason() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    const { teamId, league } = msg;
    const base   = espnBase(league);
    const season = currentSeason();

    switch (msg.type) {

      case 'GET_NEXT_MATCH': {
        const now = new Date();
        const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
        const scoreboardUrl = `${base}/scoreboard?dates=${fmt(now)}-${fmt(end)}`;
        const data = await espnGet(scoreboardUrl);
        const next = (data.events ?? [])
          .filter(e => {
            const s = e.competitions?.[0]?.status?.type?.name ?? '';
            return s === 'STATUS_SCHEDULED' || s === 'STATUS_IN_PROGRESS';
          })
          .find(e =>
            e.competitions?.[0]?.competitors?.some(c => String(c.team.id) === String(teamId))
          );
        if (!next) throw new Error('No upcoming matches found');
        // don't cache live match data so the next poll always gets fresh scores
        if (next.competitions?.[0]?.status?.type?.name === 'STATUS_IN_PROGRESS') {
          CACHE.delete(scoreboardUrl);
        }
        return { ok: true, data: next };
      }

      case 'GET_RECENT_RESULTS': {
        const data    = await espnGet(`${base}/teams/${teamId}/schedule?season=${season}`);
        const results = (data.events ?? [])
          .filter(e => {
            const s = e.competitions?.[0]?.status?.type?.name ?? '';
            return s === 'STATUS_FULL_TIME' || s === 'STATUS_FINAL' || s === 'STATUS_FULL_PEN';
          })
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);
        if (!results.length) throw new Error('No results found');
        return { ok: true, data: results };
      }

      case 'GET_SQUAD_STATS': {
        const data  = await espnGet(`${base}/teams/${teamId}/roster`);
        const squad = (data.athletes ?? []).map(p => {
          let goals = 0, assists = 0, minutesPlayed = 0, cleanSheets = 0, saves = 0;
          for (const cat of p.statistics?.splits?.categories ?? []) {
            for (const s of cat.stats ?? []) {
              if (s.name === 'totalGoals')    goals         = s.value ?? 0;
              if (s.name === 'goalAssists')   assists       = s.value ?? 0;
              if (s.name === 'minutesPlayed') minutesPlayed = s.value ?? 0;
              if (s.name === 'cleanSheets')   cleanSheets   = s.value ?? 0;
              if (s.name === 'saves')         saves         = s.value ?? 0;
            }
          }
          return {
            id:           p.id,
            name:         p.displayName,
            position:     p.position?.name ?? '',
            shirtNumber:  p.jersey ? Number(p.jersey) : null,
            nationality:  p.citizenship ?? '',
            age:          p.age ?? null,
            dateOfBirth:  p.dateOfBirth ?? null,
            birthCity:    p.birthPlace?.city ?? '',
            birthCountry: p.birthPlace?.country ?? '',
            height:       p.displayHeight ?? null,
            weight:       p.displayWeight ?? null,
            goals,
            assists,
            minutesPlayed,
            cleanSheets,
            saves,
          };
        });
        return { ok: true, data: { squad } };
      }

      case 'GET_PREMATCH': {
        const { eventId, opponentId } = msg;

        const [d1, d2, rosterData, oppData] = await Promise.all([
          espnGet(`${base}/teams/${teamId}/schedule?season=${season}`),
          espnGet(`${base}/teams/${teamId}/schedule?season=${season - 1}`),
          espnGet(`${base}/teams/${teamId}/roster`),
          espnGet(`${base}/teams/${opponentId}/schedule?season=${season}`),
        ]);
        const allEvents = [...(d1.events ?? []), ...(d2.events ?? [])];

        const isFinished = e => {
          const s = e.competitions?.[0]?.status?.type?.name ?? '';
          return s === 'STATUS_FULL_TIME' || s === 'STATUS_FINAL' || s === 'STATUS_FULL_PEN';
        };
        const scoreOf = (e, id) => {
          const c = e.competitions[0].competitors.find(c => String(c.team.id) === String(id));
          return parseFloat(c?.score?.displayValue ?? 0) || 0;
        };

        const meetings = allEvents
          .filter(e => isFinished(e) && e.competitions?.[0]?.competitors?.some(c => String(c.team.id) === String(opponentId)))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
          .map(e => {
            const ourG = scoreOf(e, teamId);
            const oppG = scoreOf(e, opponentId);
            const ours = e.competitions[0].competitors.find(c => String(c.team.id) === String(teamId));
            return { date: e.date, ourGoals: ourG, oppGoals: oppG, result: ourG > oppG ? 'W' : ourG < oppG ? 'L' : 'D', isHome: ours?.homeAway === 'home' };
          });

        const ourForm = allEvents
          .filter(isFinished)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
          .map(e => {
            const ourG = scoreOf(e, teamId);
            const opp  = e.competitions[0].competitors.find(c => String(c.team.id) !== String(teamId));
            const oppG = scoreOf(e, opp?.team?.id);
            return ourG > oppG ? 'W' : ourG < oppG ? 'L' : 'D';
          });

        const oppForm = (oppData.events ?? [])
          .filter(isFinished)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
          .map(e => {
            const oppG   = scoreOf(e, opponentId);
            const other  = e.competitions[0].competitors.find(c => String(c.team.id) !== String(opponentId));
            const otherG = scoreOf(e, other?.team?.id);
            return oppG > otherG ? 'W' : oppG < otherG ? 'L' : 'D';
          });

        const keyPlayers = (rosterData.athletes ?? []).map(p => {
          let goals = 0, assists = 0;
          for (const cat of p.statistics?.splits?.categories ?? []) {
            for (const s of cat.stats ?? []) {
              if (s.name === 'totalGoals')  goals   = s.value ?? 0;
              if (s.name === 'goalAssists') assists = s.value ?? 0;
            }
          }
          return { name: p.displayName, position: normalizePos(p.position?.abbreviation), goals, assists };
        })
          .filter(p => p.goals + p.assists > 0)
          .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
          .slice(0, 3);

        // win probability isn't available for every match, so just skip it if missing
        let homeWinPct = null, awayWinPct = null;
        try {
          const summary = await espnGet(`${base}/summary?event=${eventId}`);
          homeWinPct = parseFloat(summary.predictor?.homeTeam?.gameProjection) || null;
          awayWinPct = parseFloat(summary.predictor?.awayTeam?.gameProjection) || null;
        } catch (_) {}

        return { ok: true, data: { meetings, ourForm, oppForm, homeWinPct, awayWinPct, keyPlayers } };
      }

      case 'GET_PLAYER_INFO': {
        const data = await espnGet(`${base}/athletes/${msg.athleteId}`);
        const a = data.athlete ?? data;
        return {
          ok: true,
          data: {
            name:         a.displayName ?? '',
            position:     a.position?.name ?? '',
            age:          a.age ?? null,
            dateOfBirth:  a.dateOfBirth ?? null,
            birthCity:    a.birthPlace?.city ?? '',
            birthCountry: a.birthPlace?.country ?? '',
            height:       a.displayHeight ?? null,
            weight:       a.displayWeight ?? null,
          }
        };
      }

      case 'GET_NEWS': {
        const data  = await espnGet(`${base}/news?team=${teamId}&limit=15`);
        const items = (data.articles ?? []).map(a => ({
          headline:    a.headline ?? '',
          description: a.description ?? '',
          published:   a.published ?? '',
          link:        a.links?.web?.href ?? '',
          type:        a.type ?? '',
        }));
        return { ok: true, data: { items } };
      }

      case 'GET_RANKINGS': {
        const today = new Date().toISOString().slice(0, 10);
        const resp  = await fetch(`https://api.clubelo.com/${today}`);
        if (!resp.ok) throw new Error(`Club Elo ${resp.status}`);
        const csv  = await resp.text();
        const rows = csv.trim().split('\n').slice(1).map(line => {
          const [rank, club, country, level, elo] = line.split(',');
          return { rank: parseInt(rank) || 9999, club: club.trim(), country: country.trim(), level: parseInt(level), elo: Math.round(parseFloat(elo)) };
        }).filter(r => r.level <= 1);

        const byCountry = {};
        for (const r of rows) {
          (byCountry[r.country] ??= []).push(r.elo);
        }
        const leagueRankings = Object.entries(byCountry)
          .filter(([, elos]) => elos.length >= 4)
          .map(([country, elos]) => ({
            country,
            avgElo: Math.round(elos.reduce((a, b) => a + b, 0) / elos.length),
            clubs:  elos.length,
            topElo: Math.max(...elos),
          }))
          .sort((a, b) => b.avgElo - a.avgElo);

        const globalTop = [...rows].sort((a, b) => a.rank - b.rank).slice(0, 50);

        return { ok: true, data: { leagueRankings, globalTop, asOf: today } };
      }

      case 'GET_STATS_LEADERS': {
        const data = await espnGet(`${base}/statistics`);
        const parse = entry => {
          const a     = entry.athlete;
          const stats = Object.fromEntries((a.statistics ?? []).map(s => [s.name, s.value]));
          return {
            name:        a.displayName,
            athleteId:   a.id,
            teamId:      a.team?.id ?? null,
            teamName:    a.team?.displayName ?? '',
            goals:       stats.totalGoals  ?? 0,
            assists:     stats.goalAssists ?? 0,
            appearances: stats.appearances ?? 0,
          };
        };
        const goalsLeaders   = (data.stats?.[0]?.leaders ?? []).slice(0, 20).map(parse);
        const assistsLeaders = (data.stats?.[1]?.leaders ?? []).slice(0, 20).map(parse);
        return { ok: true, data: { goalsLeaders, assistsLeaders } };
      }

      case 'GET_STANDINGS': {
        const data    = await espnGet(`https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`);
        const entries = data.children?.[0]?.standings?.entries ?? [];
        if (!entries.length) throw new Error('Standings unavailable');
        const table = entries.map(e => {
          const stats = Object.fromEntries(e.stats.map(s => [s.name, s.displayValue]));
          return {
            id:   e.team.id,
            name: e.team.displayName,
            gp:   stats.gamesPlayed       ?? '—',
            w:    stats.wins              ?? '—',
            d:    stats.ties              ?? '—',
            l:    stats.losses            ?? '—',
            gd:   stats.pointDifferential ?? '—',
            pts:  stats.points            ?? '—',
          };
        });
        return { ok: true, data: { table } };
      }

      case 'GET_SCORING_PLAYS': {
        const { eventId } = msg;
        // direct fetch — no cache, data changes every minute during live matches
        const res = await fetch(`${base}/summary?event=${eventId}`);
        if (!res.ok) throw new Error(`ESPN ${res.status}`);
        const summary = await res.json();
        const plays = (summary.scoringPlays ?? []).map(p => {
          const athletes = p.athletesInvolved ?? [];
          const clock = p.clock?.displayValue ?? '';
          return {
            clock:     clock.includes(':') ? clock.split(':')[0] + "'" : clock,
            teamId:    String(p.team?.id ?? ''),
            scorer:    athletes[0]?.displayName ?? '',
            assist:    athletes[1]?.displayName ?? null,
            homeScore: p.homeScore ?? 0,
            awayScore: p.awayScore ?? 0,
            ownGoal:   /own.?goal|o\.g\./i.test(p.type?.text ?? ''),
          };
        });
        return { ok: true, data: { plays } };
      }

      default:
        return { ok: false, error: 'Unknown message type' };
    }
  })()
    .then(respond)
    .catch(e => respond({ ok: false, error: e.message }));

  return true;
});
