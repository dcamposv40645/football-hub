'use strict';


const DEFAULT_TEAM = { id: 83, league: 'esp.1', name: 'FC Barcelona', short: 'Barça' };
let currentTeam = DEFAULT_TEAM;

function crestUrl(id) {
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
}

function updateHeader() {
  document.getElementById('header-crest').src  = crestUrl(currentTeam.id);
  document.getElementById('header-name').textContent   = currentTeam.name;
  document.getElementById('header-league').textContent = LEAGUE_LABELS[currentTeam.league] ?? currentTeam.league;
}


const loaded = {};
const STALE_MS = 5 * 60 * 1000;

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`pane-${btn.dataset.tab}`).classList.add('active');
    loadTab(btn.dataset.tab);
  });
});

document.querySelectorAll('[data-retry]').forEach(btn => {
  btn.addEventListener('click', () => {
    delete loaded[btn.dataset.retry];
    loadTab(btn.dataset.retry);
  });
});

function loadTab(name) {
  const ts = loaded[name];
  if (ts && (name === 'teams' || Date.now() - ts < STALE_MS)) return;
  loaded[name] = Date.now();
  if (name === 'match')    loadMatch();
  if (name === 'results')  loadResults();
  if (name === 'squad')    loadSquad();
  if (name === 'table')    loadTable();
  if (name === 'rankings') loadRankings();
  if (name === 'teams')    renderTeamPicker();
}


const playerTooltip = document.getElementById('player-tooltip');
let tooltipTimer = null;

function fmtBirthday(str) {
  if (!str) return '';
  const datePart = str.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

function buildPlayerCard(p) {
  const bday     = fmtBirthday(p.dateOfBirth);
  const place    = [p.birthCity, p.birthCountry].filter(Boolean).join(', ');
  const physical = [p.height, p.weight].filter(Boolean).join(' · ');

  const rows = [
    p.position      ? `<div class="tip-row">${esc(p.position)}</div>` : '',
    bday            ? `<div class="tip-row"><span class="tip-lbl">Born</span> ${esc(bday)}${p.age ? ` <span class="tip-age">(${p.age})</span>` : ''}</div>` : '',
    place           ? `<div class="tip-row"><span class="tip-lbl">From</span> ${esc(place)}</div>` : '',
    physical        ? `<div class="tip-row">${esc(physical)}</div>` : '',
    p.minutesPlayed ? `<div class="tip-row"><span class="tip-lbl">Mins</span> ${p.minutesPlayed}'</div>` : '',
  ].filter(Boolean).join('');

  return `<div class="tip-name">${esc(p.name)}</div>${rows}`;
}

function showTooltip(row, html) {
  const rect = row.getBoundingClientRect();
  playerTooltip.innerHTML = html;
  playerTooltip.style.top  = (rect.bottom + 4) + 'px';
  playerTooltip.style.left = '0px';
  playerTooltip.style.left = Math.min(
    rect.left,
    document.documentElement.clientWidth - playerTooltip.offsetWidth - 6
  ) + 'px';
  playerTooltip.classList.add('visible');
}

function attachTooltip(row, htmlOrFn) {
  let timer = null;
  let active = false;
  row.addEventListener('mouseenter', () => {
    active = true;
    timer = setTimeout(async () => {
      const html = typeof htmlOrFn === 'function' ? await htmlOrFn() : htmlOrFn;
      if (active) showTooltip(row, html);
    }, 900);
  });
  row.addEventListener('mouseleave', () => {
    active = false;
    clearTimeout(timer);
    playerTooltip.classList.remove('visible');
  });
}


function pad(n) { return String(n).padStart(2, '0'); }

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function send(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { ...msg, teamId: currentTeam.id, league: currentTeam.league },
      res => {
        if (chrome.runtime.lastError)
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        else
          resolve(res ?? { ok: false, error: 'No response' });
      }
    );
  });
}

function natFlag(nat) {
  const F = {
    Poland:'🇵🇱', Germany:'🇩🇪', France:'🇫🇷', Spain:'🇪🇸',
    England:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', Brazil:'🇧🇷', Argentina:'🇦🇷', Portugal:'🇵🇹',
    Netherlands:'🇳🇱', Belgium:'🇧🇪', Norway:'🇳🇴', Croatia:'🇭🇷',
    Senegal:'🇸🇳', Morocco:'🇲🇦', Colombia:'🇨🇴', Uruguay:'🇺🇾',
    Italy:'🇮🇹', Denmark:'🇩🇰', Hungary:'🇭🇺', 'South Korea':'🇰🇷',
    Ghana:'🇬🇭', Nigeria:'🇳🇬', Egypt:'🇪🇬', Austria:'🇦🇹',
    Switzerland:'🇨🇭', Serbia:'🇷🇸', Mexico:'🇲🇽', Chile:'🇨🇱',
    Ecuador:'🇪🇨', Paraguay:'🇵🇾', 'Costa Rica':'🇨🇷', 'Ivory Coast':'🇨🇮',
    Georgia:'🇬🇪', Sweden:'🇸🇪', USA:'🇺🇸', Japan:'🇯🇵', Australia:'🇦🇺',
    Cameroon:'🇨🇲', Algeria:'🇩🇿', Tunisia:'🇹🇳', Mali:'🇲🇱',
    'Czech Republic':'🇨🇿', Slovakia:'🇸🇰', Wales:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', Scotland:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    Russia:'🇷🇺', Ukraine:'🇺🇦', Turkey:'🇹🇷', Greece:'🇬🇷',
  };
  return F[nat] || '';
}

function paneStates(pane, state) {
  ['loading','card','list','error','offseason'].forEach(s => {
    const el = document.getElementById(`${pane}-${s}`);
    if (el) el.style.display = s === state ? (s === 'loading' || s === 'error' || s === 'offseason' ? 'flex' : 'block') : 'none';
  });
}

function compShort(name) {
  if (/champions/i.test(name))            return 'UCL';
  if (/laliga|primera|liga/i.test(name))  return 'Liga';
  if (/premier/i.test(name))              return 'PL';
  if (/bundesliga/i.test(name))           return 'BL';
  if (/serie a/i.test(name))              return 'SA';
  if (/ligue 1/i.test(name))              return 'L1';
  if (/copa/i.test(name))                 return 'Copa';
  if (/supercopa|super cup/i.test(name))  return 'SC';
  return name.slice(0, 4).toUpperCase();
}


let kickoffDate = null;
let cdTimer     = null;
let liveTimer   = null;

function renderScoringPlays(plays) {
  const el = document.getElementById('live-events');
  el.innerHTML = '';
  if (!plays.length) { el.style.display = 'none'; return; }

  const title = document.createElement('div');
  title.className = 'pm-section-title';
  title.textContent = 'Goals';
  el.appendChild(title);

  for (const p of plays) {
    const row = document.createElement('div');
    row.className = 'scoring-row';
    const og      = p.ownGoal ? ' <span class="scoring-og">OG</span>' : '';
    const assist  = p.assist
      ? `<span class="scoring-assist">👟 ${esc(p.assist)}</span>`
      : `<span class="scoring-no-assist">No assist</span>`;
    row.innerHTML = `
      <span class="scoring-min">${esc(p.clock)}</span>
      <span class="scoring-icon">⚽</span>
      <span class="scoring-name">${esc(p.scorer)}${og}</span>
      ${assist}
      <span class="scoring-score">${p.homeScore}–${p.awayScore}</span>`;
    el.appendChild(row);
  }
  el.style.display = 'block';
}

async function loadScoringPlays(eventId) {
  const res = await send({ type: 'GET_SCORING_PLAYS', eventId });
  if (res.ok) renderScoringPlays(res.data.plays);
}

function startLivePolling() {
  clearInterval(liveTimer);
  liveTimer = setInterval(() => loadMatch(true), 60000);
}

function stopLivePolling() {
  clearInterval(liveTimer);
  liveTimer = null;
}

async function loadMatch(silent = false) {
  if (!silent) {
    paneStates('match', 'loading');
    document.getElementById('prematch').style.display    = 'none';
    document.getElementById('live-events').style.display = 'none';
  }
  try {
    const res = await send({ type: 'GET_NEXT_MATCH' });
    if (!res.ok) {
      if (res.error?.includes('No upcoming')) {
        document.getElementById('match-offseason-msg').textContent =
          `${currentTeam.name} — Season Complete`;
        paneStates('match', 'offseason');
      } else {
        throw new Error(res.error || 'API error');
      }
      stopLivePolling();
      return;
    }
    const isLive = res.data.competitions?.[0]?.status?.type?.name === 'STATUS_IN_PROGRESS';
    renderMatch(res.data);
    paneStates('match', 'card');
    if (isLive) {
      startLivePolling();
      loadScoringPlays(res.data.id);
      if (!silent) loadPreMatch(res.data);
    } else {
      stopLivePolling();
      document.getElementById('live-events').style.display = 'none';
      loadPreMatch(res.data);
    }
  } catch (e) {
    document.getElementById('match-err-msg').textContent = e.message;
    paneStates('match', 'error');
    stopLivePolling();
  }
}

async function loadPreMatch(event) {
  const comp = event.competitions[0];
  const ours = comp.competitors.find(c => String(c.team.id) === String(currentTeam.id));
  const opp  = comp.competitors.find(c => String(c.team.id) !== String(currentTeam.id));
  const venue = comp.venue?.fullName ?? '';
  const venueCity = comp.venue?.address?.city ?? '';

  const res = await send({ type: 'GET_PREMATCH', eventId: event.id, opponentId: opp?.team?.id });
  if (!res.ok) return;

  renderPreMatch(res.data, {
    isHome: ours?.homeAway === 'home',
    venue, venueCity,
    ourTeam: currentTeam,
    oppTeam: opp?.team,
  });
}

function formDots(form) {
  return form.map(r => `<span class="form-dot fd-${r}">${r}</span>`).join('');
}

function renderPreMatch({ meetings, ourForm, oppForm, homeWinPct, awayWinPct, keyPlayers }, { isHome, venue, venueCity, ourTeam, oppTeam }) {
  const el = document.getElementById('prematch');
  el.innerHTML = '';

  if (venue) {
    const v = document.createElement('div');
    v.className = 'pm-venue';
    v.textContent = venueCity ? `${venue} · ${venueCity}` : venue;
    el.appendChild(v);
  }

  if (ourForm.length || oppForm?.length) {
    const ourLabel = esc(ourTeam.short ?? ourTeam.name);
    const oppLabel = esc(oppTeam?.abbreviation ?? oppTeam?.displayName?.split(' ').pop() ?? 'Opp');
    const sec = document.createElement('div');
    sec.className = 'pm-section';
    sec.innerHTML = `<div class="pm-section-title">Form</div>`;
    if (ourForm.length) {
      sec.innerHTML += `<div class="pm-form-row"><span class="pm-form-label">${ourLabel}</span><span class="pm-dots">${formDots(ourForm)}</span></div>`;
    }
    if (oppForm?.length) {
      sec.innerHTML += `<div class="pm-form-row"><span class="pm-form-label">${oppLabel}</span><span class="pm-dots">${formDots(oppForm)}</span></div>`;
    }
    el.appendChild(sec);
  }

  if (meetings.length) {
    const wins   = meetings.filter(m => m.result === 'W').length;
    const draws  = meetings.filter(m => m.result === 'D').length;
    const losses = meetings.filter(m => m.result === 'L').length;

    const pills = [
      wins   ? `<span class="pm-h2h-pill pill-w">${wins}W</span>`   : '',
      draws  ? `<span class="pm-h2h-pill pill-d">${draws}D</span>`  : '',
      losses ? `<span class="pm-h2h-pill pill-l">${losses}L</span>` : '',
    ].join('');

    const h = document.createElement('div');
    h.className = 'pm-section pm-section-ruled';
    h.innerHTML = `
      <div class="pm-section-title">
        Head to Head
        <span class="pm-h2h-pills">${pills}</span>
      </div>`;

    for (const m of meetings) {
      const d = new Date(m.date);
      const dateStr = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const row = document.createElement('div');
      row.className = 'pm-h2h-row';
      row.innerHTML = `
        <span class="pm-h2h-indicator pm-dot-${m.result}"></span>
        <span class="pm-h2h-score">${m.ourGoals}–${m.oppGoals}</span>
        <span class="pm-h2h-meta">${esc(dateStr)} · ${m.isHome ? 'Home' : 'Away'}</span>`;
      h.appendChild(row);
    }
    el.appendChild(h);
  }

  if (keyPlayers?.length) {
    const rankColors = ['var(--gold)', 'rgba(255,255,255,.55)', 'rgba(255,255,255,.28)'];
    const kp = document.createElement('div');
    kp.className = 'pm-section pm-section-ruled';
    kp.innerHTML = `<div class="pm-section-title">Key Players</div>`;
    keyPlayers.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'pm-kp-row';
      const pos = p.position ? `<span class="pm-kp-pos">${esc(p.position)}</span>` : '';
      row.innerHTML = `
        <span class="pm-kp-rank" style="color:${rankColors[i]}">${i + 1}</span>
        <span class="pm-kp-name">${esc(p.name)}</span>
        ${pos}
        <span class="pm-kp-stat pm-kp-g">${p.goals}G</span>
        <span class="pm-kp-stat pm-kp-a">${p.assists}A</span>`;
      kp.appendChild(row);
    });
    el.appendChild(kp);
  }

  if (homeWinPct !== null && awayWinPct !== null) {
    const ourPct  = isHome ? homeWinPct : awayWinPct;
    const oppPct  = isHome ? awayWinPct : homeWinPct;
    const drawPct = Math.max(0, Math.round(100 - ourPct - oppPct));
    const oppName = esc(oppTeam?.displayName ?? oppTeam?.name ?? 'Opp');

    const p = document.createElement('div');
    p.className = 'pm-section pm-section-ruled';
    p.innerHTML = `
      <div class="pm-section-title">Win Probability</div>
      <div class="pm-prob-labels">
        <span>${esc(ourTeam.short ?? ourTeam.name)}</span>
        <span>Draw</span>
        <span>${oppName}</span>
      </div>
      <div class="pm-prob-bar">
        <div class="pm-prob-our"  style="width:${ourPct}%">${Math.round(ourPct)}%</div>
        <div class="pm-prob-draw" style="width:${drawPct}%">${drawPct > 9 ? drawPct + '%' : ''}</div>
        <div class="pm-prob-opp"  style="width:${oppPct}%">${Math.round(oppPct)}%</div>
      </div>`;
    el.appendChild(p);
  }

  el.style.display = 'block';
}

function renderMatch(event) {
  const comp        = event.competitions[0];
  const competitors = comp.competitors;
  const ours   = competitors.find(c => String(c.team.id) === String(currentTeam.id));
  const opp    = competitors.find(c => String(c.team.id) !== String(currentTeam.id));
  const isHome = ours?.homeAway === 'home';
  const isLive = comp.status?.type?.name === 'STATUS_IN_PROGRESS';

  const ourCrest = crestUrl(currentTeam.id);
  const oppCrest = crestUrl(opp?.team?.id);
  const oppName  = opp?.team?.displayName ?? '';

  document.getElementById('m-home-crest').src        = isHome ? ourCrest : oppCrest;
  document.getElementById('m-home-name').textContent = isHome ? currentTeam.name : oppName;
  document.getElementById('m-away-crest').src        = isHome ? oppCrest : ourCrest;
  document.getElementById('m-away-name').textContent = isHome ? oppName : currentTeam.name;
  document.getElementById('m-comp').textContent = compShort(event.league?.name ?? '');

  kickoffDate = new Date(event.date);
  document.getElementById('m-date').textContent =
    kickoffDate.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) +
    ' · ' +
    kickoffDate.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  const vsMid = document.querySelector('.vs-mid');

  if (isLive) {
    const homeComp  = competitors.find(c => c.homeAway === 'home');
    const awayComp  = competitors.find(c => c.homeAway === 'away');
    const homeScore = homeComp?.score?.displayValue ?? '0';
    const awayScore = awayComp?.score?.displayValue ?? '0';
    const clock     = comp.status?.displayClock ?? comp.status?.type?.shortDetail ?? '';

    vsMid.textContent = `${homeScore}–${awayScore}`;
    vsMid.className   = 'vs-mid vs-score-live';

    document.getElementById('live-clock').textContent = clock;
    document.querySelector('.countdown-box').style.display = 'none';
    document.getElementById('live-box').style.display      = 'flex';

    clearInterval(cdTimer);
  } else {
    vsMid.textContent = 'VS';
    vsMid.className   = 'vs-mid';

    document.querySelector('.countdown-box').style.display = '';
    document.getElementById('live-box').style.display      = 'none';

    clearInterval(cdTimer);
    tick();
    cdTimer = setInterval(tick, 1000);
  }
}

function tick() {
  if (!kickoffDate) return;
  const diff = kickoffDate - Date.now();
  if (diff <= 0) { clearInterval(cdTimer); setcd(0,0,0,0); return; }
  setcd(
    Math.floor(diff / 86400000),
    Math.floor((diff % 86400000) / 3600000),
    Math.floor((diff % 3600000)  / 60000),
    Math.floor((diff % 60000)    / 1000)
  );
}

function setcd(d, h, m, s) {
  document.getElementById('cd-d').textContent = pad(d);
  document.getElementById('cd-h').textContent = pad(h);
  document.getElementById('cd-m').textContent = pad(m);
  document.getElementById('cd-s').textContent = pad(s);
}


async function loadResults() {
  paneStates('results', 'loading');
  try {
    const res = await send({ type: 'GET_RECENT_RESULTS' });
    if (!res.ok) throw new Error(res.error || 'API error');
    renderResults(res.data);
    paneStates('results', 'list');
  } catch (e) {
    document.getElementById('results-err-msg').textContent = e.message;
    paneStates('results', 'error');
  }
}

function renderResults(events) {
  const container = document.getElementById('results-list');
  container.innerHTML = '';

  for (const event of events) {
    const comp        = event.competitions[0];
    const competitors = comp.competitors;
    const ours = competitors.find(c => String(c.team.id) === String(currentTeam.id));
    const opp  = competitors.find(c => String(c.team.id) !== String(currentTeam.id));

    const isHome  = ours?.homeAway === 'home';
    const ourGoals = parseFloat(ours?.score?.displayValue ?? 0) || 0;
    const oppGoals = parseFloat(opp?.score?.displayValue  ?? 0) || 0;
    const wdl = ourGoals > oppGoals ? 'W' : ourGoals < oppGoals ? 'L' : 'D';

    const date    = new Date(event.date);
    const dateStr = date.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    const league  = compShort(event.league?.name ?? '');
    const venue   = isHome ? 'H' : 'A';
    const oppCrest = crestUrl(opp?.team?.id);
    const oppName  = opp?.team?.displayName ?? '—';

    const row = document.createElement('div');
    row.className = 'result-row';
    row.innerHTML = `
      <div class="r-badge r-${wdl}">${wdl}</div>
      <div class="r-date">${esc(dateStr)}</div>
      <div class="r-comp">${esc(league)}</div>
      <div class="r-opp">
        <img class="r-opp-crest" src="${esc(oppCrest)}" alt="" onerror="this.style.display='none'">
        <span class="r-opp-name">${esc(oppName)}</span>
      </div>
      <div class="r-score">${ourGoals}–${oppGoals}</div>
      <div class="r-venue">${venue}</div>`;
    container.appendChild(row);
  }
}


const POSITION_GROUPS = [
  { label: 'Goalkeepers', test: p => /GOALKEEPER|KEEPER/i.test(p) },
  { label: 'Defenders',   test: p => /DEFEND|BACK|STOPPER/i.test(p) },
  { label: 'Midfielders', test: p => /MIDFIELD/i.test(p) },
  { label: 'Forwards',    test: p => /FORWARD|WINGER|ATTACK|OFFENCE/i.test(p) },
];

let squadData = null;
let squadSort = 'goals';

async function loadSquad() {
  paneStates('squad', 'loading');
  try {
    const res = await send({ type: 'GET_SQUAD_STATS' });
    if (!res.ok) throw new Error(res.error || 'API error');
    if (!res.data?.squad?.length) throw new Error('Squad data unavailable');
    renderSquad(res.data.squad);
    paneStates('squad', 'list');
    document.getElementById('squad-sort-bar').style.display = 'flex';
  } catch (e) {
    document.getElementById('squad-err-msg').textContent = e.message;
    document.getElementById('squad-sort-bar').style.display = 'none';
    paneStates('squad', 'error');
  }
}

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!squadData) return;
    squadSort = btn.dataset.sort;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSquad(squadData);
  });
});

function renderSquad(squad) {
  squadData = squad;
  const container = document.getElementById('squad-list');
  container.innerHTML = '';

  for (const group of POSITION_GROUPS) {
    const isGK = group.label === 'Goalkeepers';
    const players = squad
      .filter(p => group.test(p.position || ''))
      .sort((a, b) =>
        (b[squadSort] - a[squadSort]) ||
        (squadSort === 'goals' ? b.assists - a.assists : b.goals - a.goals) ||
        ((a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
      );

    if (!players.length) continue;

    const section = document.createElement('div');
    section.className = 'pos-group';
    section.innerHTML = `<div class="pos-header">${group.label}</div>`;

    for (const p of players) {
      const mins = p.minutesPlayed ? `${p.minutesPlayed}'` : '—';
      const statCols = isGK
        ? `<span class="p-stat p-cs">${p.cleanSheets}CS</span>
           <span class="p-stat p-saves">${p.saves}Sv</span>`
        : `<span class="p-stat p-goals">${p.goals}G</span>
           <span class="p-stat p-assists">${p.assists}A</span>`;

      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <span class="p-num">${p.shirtNumber ?? ''}</span>
        <span class="p-name-text p-name" title="${esc(p.name)}">${esc(p.name)}</span>
        <span class="p-flag">${natFlag(p.nationality)}</span>
        <span class="p-stat p-mins">${mins}</span>
        ${statCols}`;

      attachTooltip(row, buildPlayerCard(p));

      section.appendChild(row);
    }

    container.appendChild(section);
  }
}


let tableView    = 'standings';
let standingsCache = null;
let leadersCache   = null;
let rankingsView  = 'leagues';
let rankingsCache = null;

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tableView = btn.dataset.view;
    await showTableView();
  });
});

document.querySelectorAll('[data-rview]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-rview]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rankingsView = btn.dataset.rview;
    if (rankingsCache) renderRankings(rankingsCache);
  });
});

async function loadTable() {
  await showTableView();
}

async function showTableView() {
  paneStates('table', 'loading');
  try {
    if (tableView === 'standings') {
      if (!standingsCache) {
        const res = await send({ type: 'GET_STANDINGS' });
        if (!res.ok) throw new Error(res.error || 'API error');
        standingsCache = res.data.table;
      }
      renderTable(standingsCache);
    } else {
      if (!leadersCache) {
        const res = await send({ type: 'GET_STATS_LEADERS' });
        if (!res.ok) throw new Error(res.error || 'API error');
        leadersCache = res.data;
      }
      renderLeaders(tableView === 'scorers' ? leadersCache.goalsLeaders : leadersCache.assistsLeaders, tableView);
    }
    paneStates('table', 'list');
  } catch (e) {
    document.getElementById('table-err-msg').textContent = e.message;
    paneStates('table', 'error');
  }
}

function renderTable(rows) {
  const container = document.getElementById('table-list');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'standings-wrap';

  const header = document.createElement('div');
  header.className = 'standing-row standing-header';
  header.innerHTML = `
    <span class="st-pos">#</span>
    <span class="st-team"></span>
    <span class="st-num">GP</span>
    <span class="st-num">W</span>
    <span class="st-num">D</span>
    <span class="st-num">L</span>
    <span class="st-num">GD</span>
    <span class="st-pts">Pts</span>`;
  wrap.appendChild(header);

  rows.forEach((row, i) => {
    const isMine = String(row.id) === String(currentTeam.id);
    const el = document.createElement('div');
    el.className = 'standing-row' + (isMine ? ' mine' : '');
    el.innerHTML = `
      <span class="st-pos">${i + 1}</span>
      <span class="st-team">
        <img class="st-crest" src="${crestUrl(row.id)}" alt="" onerror="this.style.display='none'">
        <span class="st-name">${esc(row.name)}</span>
      </span>
      <span class="st-num">${row.gp}</span>
      <span class="st-num">${row.w}</span>
      <span class="st-num">${row.d}</span>
      <span class="st-num">${row.l}</span>
      <span class="st-num">${row.gd}</span>
      <span class="st-pts">${row.pts}</span>`;
    wrap.appendChild(el);
  });

  container.appendChild(wrap);
}

function renderLeaders(entries, view) {
  const container = document.getElementById('table-list');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'leaders-wrap';

  entries.forEach((p, i) => {
    const isMine = String(p.teamId) === String(currentTeam.id);
    const mainStat  = view === 'scorers' ? p.goals   : p.assists;
    const otherLabel = view === 'scorers' ? `${p.assists}A` : `${p.goals}G`;

    const row = document.createElement('div');
    row.className = 'leader-row' + (isMine ? ' mine' : '');
    row.innerHTML = `
      <span class="ld-pos">${i + 1}</span>
      <span class="ld-info">
        <span class="ld-name">${esc(p.name)}</span>
        <span class="ld-team">
          <img class="ld-crest" src="${crestUrl(p.teamId)}" alt="" onerror="this.style.display='none'">
          ${esc(p.teamName)}
        </span>
      </span>
      <span class="ld-stat">${mainStat}</span>
      <span class="ld-other">${otherLabel}</span>`;

    const athleteId = p.athleteId;
    attachTooltip(row, async () => {
      const res = await send({ type: 'GET_PLAYER_INFO', athleteId });
      if (!res.ok) return `<div class="tip-name">${esc(p.name)}</div>`;
      return buildPlayerCard({ ...res.data, minutesPlayed: null });
    });

    wrap.appendChild(row);
  });

  container.appendChild(wrap);
}


async function loadRankings() {
  paneStates('rankings', 'loading');
  try {
    const res = await send({ type: 'GET_RANKINGS' });
    if (!res.ok) throw new Error(res.error || 'API error');
    renderRankings(res.data);
    paneStates('rankings', 'list');
  } catch (e) {
    document.getElementById('rankings-err-msg').textContent = e.message;
    paneStates('rankings', 'error');
  }
}

function mkSection(title, sub) {
  const h = document.createElement('div');
  h.className = 'rk-section-header';
  h.textContent = title;
  const s = document.createElement('div');
  s.className = 'rk-section-sub';
  s.textContent = sub;
  return [h, s];
}

function renderRankings(data) {
  rankingsCache = data;
  const { leagueRankings, globalTop, asOf } = data;
  const container = document.getElementById('rankings-list');
  container.innerHTML = '';
  const dateLabel = asOf ? new Date(asOf + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  if (rankingsView === 'leagues') {
    const myCountry = LEAGUE_COUNTRY[currentTeam.league] ?? '';
    const topElo    = leagueRankings[0]?.avgElo ?? 1;

    const lh = document.createElement('div');
    lh.className = 'rk-section-header';
    lh.innerHTML = `<span>League World Rankings</span>${dateLabel ? `<span class="rk-date-badge">${dateLabel}</span>` : ''}`;
    const ls = document.createElement('div');
    ls.className = 'rk-section-sub';
    ls.textContent = 'Ranked by strength of each country\'s top flight · Club Elo';
    const ld = document.createElement('div');
    ld.className = 'rk-disclaimer';
    ld.textContent = 'Elo ratings are a mathematical model — not an official ranking. European football only.';
    container.append(lh, ls, ld);

    leagueRankings.forEach((r, i) => {
      const info   = LEAGUE_INFO[r.country] ?? { name: r.country, flag: '' };
      const isMine = r.country === myCountry;
      const barW   = Math.round((r.avgElo / topElo) * 100);
      const el = document.createElement('div');
      el.className = 'ranking-row' + (isMine ? ' mine' : '');
      el.innerHTML = `
        <span class="rk-pos">${i + 1}</span>
        <span class="rk-team">
          <span class="rk-flag">${info.flag}</span>
          <span class="rk-name">${esc(info.name)}</span>
        </span>
        <span class="rk-bar-wrap"><span class="rk-bar" style="width:${barW}%"></span></span>
        <span class="rk-elo">${r.avgElo}</span>`;
      container.appendChild(el);
    });
  } else {
    const gh = document.createElement('div');
    gh.className = 'rk-section-header';
    gh.innerHTML = `<span>Global Club Top 50</span>${dateLabel ? `<span class="rk-date-badge">${dateLabel}</span>` : ''}`;
    const gs = document.createElement('div');
    gs.className = 'rk-section-sub';
    gs.textContent = 'Best clubs in the world right now · Club Elo';
    const gd = document.createElement('div');
    gd.className = 'rk-disclaimer';
    gd.textContent = 'Elo ratings are a mathematical model — not an official ranking. European football only.';
    container.append(gh, gs, gd);

    globalTop.forEach(r => {
      const espnId = CLUBELO_IDS[r.club] ?? null;
      const isMine = String(espnId) === String(currentTeam.id);
      const el = document.createElement('div');
      el.className = 'ranking-row' + (isMine ? ' mine' : '');
      el.innerHTML = `
        <span class="rk-pos">${r.rank}</span>
        <span class="rk-team">
          ${espnId ? `<img class="rk-crest" src="${crestUrl(espnId)}" alt="" onerror="this.style.display='none'">` : ''}
          <span class="rk-name">${esc(r.club)}</span>
        </span>
        <span class="rk-bar-wrap"></span>
        <span class="rk-elo">${r.elo}</span>`;
      container.appendChild(el);
    });
  }
}


async function loadNews() {
  paneStates('news', 'loading');
  try {
    const res = await send({ type: 'GET_NEWS' });
    if (!res.ok) throw new Error(res.error || 'API error');
    if (!res.data.items.length) throw new Error('No news available');
    renderNews(res.data.items);
    paneStates('news', 'list');
  } catch (e) {
    document.getElementById('news-err-msg').textContent = e.message;
    paneStates('news', 'error');
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function renderNews(items) {
  const container = document.getElementById('news-list');
  container.innerHTML = '';

  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'news-item';

    const typeLabel = item.type === 'HeadlineNews' ? 'NEWS'
      : item.type === 'Media' ? 'VIDEO'
      : item.type ? item.type.replace(/([A-Z])/g, ' $1').trim().toUpperCase()
      : 'NEWS';

    el.innerHTML = `
      <div class="news-meta">
        <span class="news-type">${esc(typeLabel)}</span>
        <span class="news-time">${timeAgo(item.published)}</span>
      </div>
      <div class="news-headline">${esc(item.headline)}</div>
      ${item.description ? `<div class="news-desc">${esc(item.description)}</div>` : ''}`;

    if (item.link) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => chrome.tabs.create({ url: item.link }));
    }

    container.appendChild(el);
  }
}


function renderTeamPicker(filter = '') {
  const container = document.getElementById('teams-list');
  container.innerHTML = '';

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? TEAMS.filter(t => t.name.toLowerCase().includes(q) || t.short.toLowerCase().includes(q))
    : TEAMS;

  if (!filtered.length) {
    container.innerHTML = '<div class="teams-empty">No clubs found</div>';
    return;
  }

  if (q) {
    // no need to group when the user is searching
    for (const team of filtered) renderTeamRow(container, team);
  } else {
    const byLeague = {};
    for (const team of filtered) {
      (byLeague[team.league] ??= []).push(team);
    }
    for (const [league, teams] of Object.entries(byLeague)) {
      const header = document.createElement('div');
      header.className = 'teams-league-header';
      header.textContent = LEAGUE_LABELS[league] ?? league;
      container.appendChild(header);
      for (const team of teams) renderTeamRow(container, team);
    }
  }
}

function renderTeamRow(container, team) {
  const row = document.createElement('div');
  row.className = 'team-row' + (team.id === currentTeam.id ? ' selected' : '');
  row.innerHTML = `
    <img class="team-row-crest" src="${crestUrl(team.id)}" alt="" onerror="this.style.display='none'">
    <span class="team-row-name">${esc(team.name)}</span>
    ${team.id === currentTeam.id ? '<span class="team-row-check">✓</span>' : ''}`;
  row.addEventListener('click', () => selectTeam(team));
  container.appendChild(row);
}

function selectTeam(team) {
  currentTeam = team;
  chrome.storage.local.set({ selectedTeam: team });
  updateHeader();
  stopLivePolling();

  // wipe everything so all tabs reload with the new team's data
  Object.keys(loaded).forEach(k => delete loaded[k]);
  document.getElementById('table-list').innerHTML = '';
  document.getElementById('rankings-list').innerHTML = '';
  standingsCache = null;
  leadersCache   = null;
  rankingsCache  = null;
  tableView = 'standings';
  document.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === 'standings');
  });
  rankingsView = 'leagues';
  document.querySelectorAll('[data-rview]').forEach(b => {
    b.classList.toggle('active', b.dataset.rview === 'leagues');
  });
  squadData = null;
  squadSort = 'goals';
  document.getElementById('squad-sort-bar').style.display = 'none';
  document.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === 'goals');
  });

  // always land on the match tab after picking a team
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  const matchTab = document.querySelector('[data-tab="match"]');
  matchTab.classList.add('active');
  document.getElementById('pane-match').classList.add('active');
  loadTab('match');
}

document.getElementById('team-search').addEventListener('input', e => {
  renderTeamPicker(e.target.value);
});

document.getElementById('change-team-btn').addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-teams').classList.add('active');
  if (!loaded['teams']) { loaded['teams'] = true; renderTeamPicker(); }
});

document.getElementById('news-btn').addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-news').classList.add('active');
  const newsTs = loaded['news'];
  if (!newsTs || Date.now() - newsTs >= STALE_MS) { loaded['news'] = Date.now(); loadNews(); }
});


chrome.storage.local.get('selectedTeam', ({ selectedTeam }) => {
  if (selectedTeam) {
    currentTeam = selectedTeam;
    updateHeader();
    loadTab('match');
  } else {
    // first install — skip the default team and let the user pick
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-teams').classList.add('active');
    loaded['teams'] = Date.now();
    renderTeamPicker('');
  }
});
