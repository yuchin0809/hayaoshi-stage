// 早押しステージの対戦サーバー（Cloudflare Workers + Durable Objects）
// ・ランクマッチ（近いランクから探して、待つほど範囲をひろげる。30秒でそろわなければCPUで埋める）
// ・ルーム戦（4けたの部屋番号）
// ・試合の進行と早押しの判定（だれが一番に押したかは、サーバーに届いた順で決める）
import { tierOf, searchRange, mixForTiers, botParams, rankStrength, ansLimit, CHARS_PER_SEC, BOT_FILL_SEC, botName, botRpInTier } from '../../net.js';
import lv1 from '../../questions/lv1.json';
import lv2 from '../../questions/lv2.json';
import lv3 from '../../questions/lv3.json';
import lv4 from '../../questions/lv4.json';
import lv5 from '../../questions/lv5.json';
import lv6 from '../../questions/lv6.json';

const QB = [lv1, lv2, lv3, lv4, lv5, lv6];
const READY_MS = 1500, INTRO_MS = 1550, JUDGE_OK_MS = 3600, JUDGE_NG_MS = 2000, REVEAL_MS = 3200, IDLE_MS = 5000, TICK_MS = 100;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket で接続してください', { status: 426 });
      return env.HUB.get(env.HUB.idFromName('main')).fetch(req);
    }
    return new Response('hayaoshi-server: 動いています', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};

function pickQuestions(n, weights) {
  const out = [], used = new Set();
  for (let k = 0; k < n; k++) {
    const w = weights.map((v, i) => QB[i].length ? v : 0); if (w.every(v => !v)) break;
    let r = Math.random() * w.reduce((a, b) => a + b, 0), L = 0;
    for (let i = 0; i < 6; i++) { r -= w[i]; if (r <= 0) { L = i; break; } }
    let j, tries = 0; do { j = Math.floor(Math.random() * QB[L].length); } while (used.has(L + ':' + j) && ++tries < 50);
    used.add(L + ':' + j); const [q, a, y] = QB[L][j]; out.push({ q, a, y, lv: L + 1 });
  }
  return out;
}
const cleanName = s => String(s || '').replace(/[<>&"'\\]/g, '').trim().slice(0, 8) || 'ななし';

export class Hub {
  constructor(state, env) {
    this.state = state; this.nextId = 1;
    this.queue = [];             // ランクマッチ待ち {cl, t0}
    this.rooms = new Map();      // 部屋番号 → {code, members:[cl], bots:[], n}
    this.games = new Set();
    this.matchTimer = null;
  }

  fetch(req) {
    const pair = new WebSocketPair(), [client, ws] = [pair[0], pair[1]];
    ws.accept();
    const cl = { id: this.nextId++, ws, name: 'ななし', rp: 0, room: null, game: null, seat: -1 };
    ws.addEventListener('message', e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } try { this.onMsg(cl, m); } catch (err) { console.log('msg error', err); } });
    const bye = () => this.leave(cl);
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(cl, m) { try { if (cl && !cl.gone) cl.ws.send(JSON.stringify(m)); } catch (_) {} }

  onMsg(cl, m) {
    switch (m.t) {
      case 'hello': cl.name = cleanName(m.name); cl.rp = Math.max(0, Math.min(5000, Math.floor(+m.rp || 0))); break;
      case 'find': if (cl.game) return; this.leaveRoom(cl); this.dequeue(cl); this.queue.push({ cl, t0: Date.now() }); this.startMatchTimer(); this.matchTick(); break;
      case 'cancel': this.dequeue(cl); break;
      case 'create': this.createRoom(cl, m.n); break;
      case 'join': this.joinRoom(cl, String(m.code || '')); break;
      case 'addbot': this.addBot(cl); break;
      case 'start': this.startRoom(cl, m.n); break;
      case 'leave': this.leaveRoom(cl); break;
      case 'buzz': if (cl.game) cl.game.buzz(cl.seat); break;
      case 'char': if (cl.game && typeof m.ch === 'string') cl.game.char(cl.seat, m.ch.slice(0, 1)); break;
    }
  }

  leave(cl) {
    if (cl.gone) return; cl.gone = true;
    this.dequeue(cl); this.leaveRoom(cl);
    if (cl.game) cl.game.playerGone(cl.seat);
  }

  // ── ランクマッチ ──
  dequeue(cl) { this.queue = this.queue.filter(e => e.cl !== cl); if (!this.queue.length) this.stopMatchTimer(); }
  startMatchTimer() { if (!this.matchTimer) this.matchTimer = setInterval(() => this.matchTick(), 1000); }
  stopMatchTimer() { clearInterval(this.matchTimer); this.matchTimer = null; }
  matchTick() {
    const now = Date.now();
    const info = this.queue.map(e => { const sec = Math.floor((now - e.t0) / 1000), tier = tierOf(e.cl.rp); return { e, sec, tier, range: searchRange(tier, sec) }; });
    const ok = (a, b) => b.tier >= a.range[0] && b.tier <= a.range[1] && a.tier >= b.range[0] && a.tier <= b.range[1];
    const taken = new Set();
    for (const a of info) {               // 早く待ち始めた人から順に組む
      if (taken.has(a)) continue;
      const mates = info.filter(b => b !== a && !taken.has(b) && ok(a, b)).slice(0, 3);
      if (mates.length >= 3 || a.sec >= BOT_FILL_SEC) {
        const group = [a, ...mates]; group.forEach(g => taken.add(g));
        const players = group.map(g => ({ cl: g.e.cl, name: g.e.cl.name, rp: g.e.cl.rp }));
        const used = new Set(players.map(p => p.name));
        while (players.length < 4) { const t = a.range[0] + Math.floor(Math.random() * (a.range[1] - a.range[0] + 1)); const rp = botRpInTier(t); players.push({ cl: null, name: botName(used), rp, str: rankStrength(rp) }); }
        this.startGame(players, 10, 'rank');
      } else {
        this.send(a.e.cl, { t: 'search', sec: a.sec, range: a.range, players: mates.map(b => ({ name: b.e.cl.name, rp: b.e.cl.rp })) });
      }
    }
    if (taken.size) { this.queue = this.queue.filter(e => !info.some(i => i.e === e && taken.has(i))); if (!this.queue.length) this.stopMatchTimer(); }
  }

  // ── ルーム戦 ──
  roomView(r) { return [...r.members.map((c, i) => ({ name: c.name + (i === 0 ? '（主）' : ''), rp: c.rp })), ...r.bots.map(b => ({ name: b.name, rp: b.rp, bot: true }))]; }
  roomCast(r) { r.members.forEach((c, i) => this.send(c, { t: 'room', code: r.code, players: this.roomView(r), host: i === 0 })); }
  createRoom(cl, n) {
    if (cl.game) return; this.dequeue(cl); this.leaveRoom(cl);
    let code; do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (this.rooms.has(code));
    const r = { code, members: [cl], bots: [], n: [5, 10, 20].includes(+n) ? +n : 10 };
    this.rooms.set(code, r); cl.room = r; this.roomCast(r);
  }
  joinRoom(cl, code) {
    if (cl.game) return; const r = this.rooms.get(code);
    if (!r) return this.send(cl, { t: 'error', msg: 'その番号の部屋は見つかりませんでした' });
    if (r.playing) return this.send(cl, { t: 'error', msg: 'その部屋はいま試合中です' });
    if (r.members.length + r.bots.length >= 4) return this.send(cl, { t: 'error', msg: 'その部屋は満員です' });
    this.dequeue(cl); this.leaveRoom(cl); r.members.push(cl); cl.room = r; this.roomCast(r);
  }
  addBot(cl) {
    const r = cl.room; if (!r || r.members[0] !== cl || r.playing || r.members.length + r.bots.length >= 4) return;
    const used = new Set([...r.members.map(c => c.name), ...r.bots.map(b => b.name)]);
    const t = Math.max(0, Math.min(4, tierOf(cl.rp) + Math.floor(Math.random() * 3) - 1)), rp = botRpInTier(t);
    r.bots.push({ name: botName(used), rp, str: rankStrength(rp) }); this.roomCast(r);
  }
  leaveRoom(cl) {
    const r = cl.room; if (!r) return; cl.room = null;
    r.members = r.members.filter(c => c !== cl);
    if (!r.members.length) this.rooms.delete(r.code); else this.roomCast(r);
  }
  startRoom(cl, n) {
    const r = cl.room; if (!r || r.members[0] !== cl || r.playing) return;
    if ([5, 10, 20].includes(+n)) r.n = +n;
    const players = [...r.members.map(c => ({ cl: c, name: c.name, rp: c.rp })), ...r.bots.map(b => ({ cl: null, ...b }))];
    const used = new Set(players.map(p => p.name));
    while (players.length < 4) { const rp = botRpInTier(tierOf(cl.rp)); players.push({ cl: null, name: botName(used), rp, str: rankStrength(rp) }); }
    r.playing = true;
    this.startGame(players, r.n, 'room', r);
  }

  startGame(players, n, mode, room = null) {
    const g = new Game(this, players, n, mode, room); this.games.add(g); g.start();
  }
  gameOver(g) {
    this.games.delete(g);
    if (g.room) { g.room.playing = false; g.room.bots = g.room.bots; if (this.rooms.has(g.room.code)) this.roomCast(g.room); }
  }
}

class Game {
  constructor(hub, players, n, mode, room) {
    this.hub = hub; this.mode = mode; this.room = room;
    // 席の順番をまぜる
    this.seats = players.sort(() => Math.random() - .5).map(p => ({ ...p, tier: tierOf(p.rp), gone: false }));
    const tiers = this.seats.map(s => s.tier);
    this.questions = pickQuestions(n, mixForTiers(Math.min(...tiers), Math.max(...tiers)));
    this.scores = [0, 0, 0, 0]; this.qi = 0; this.phase = 'ready'; this.timers = new Set();
    this.seats.forEach((s, i) => { if (s.cl) { s.cl.game = this; s.cl.seat = i; } });
  }
  cast(m) { this.seats.forEach(s => s.cl && this.hub.send(s.cl, m)); }
  later(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); if (!this.over) fn(); }, ms); this.timers.add(t); }
  start() {
    const players = this.seats.map(s => ({ name: s.name, rp: s.rp, bot: !s.cl }));
    this.seats.forEach((s, i) => s.cl && this.hub.send(s.cl, { t: 'begin', mode: this.mode, seat: i, players, questions: this.questions }));
    this.tick = setInterval(() => this.onTick(), TICK_MS);
    this.later(READY_MS, () => this.intro(0));
  }
  get Q() { return this.questions[this.qi]; }
  shown() { return this.phase === 'reading' ? Math.min(this.Q.q.length, Math.floor(this.base + (Date.now() - this.t0) / 1000 * CHARS_PER_SEC)) : this.base; }
  intro(i) { this.qi = i; this.phase = 'intro'; this.cast({ t: 'intro', i }); this.later(INTRO_MS, () => this.read(0, true)); }
  read(from, fresh) {
    if (fresh) {
      this.locked = new Set(this.seats.map((s, i) => s.gone ? i : -1).filter(i => i >= 0));
      const Q = this.Q;
      this.plans = this.seats.map((s, i) => {
        if (s.cl || s.gone) return null;
        const L = botParams(s.str - (Q.lv - 2 - s.tier) * .07);
        return Math.random() < L.prob ? { i, at: Math.floor(Q.q.length * Math.max(.25, Math.min(1, L.from + Math.random() * L.span))), delay: L.delay[0] + Math.random() * (L.delay[1] - L.delay[0]), skill: L.skill } : null;
      }).filter(Boolean);
    }
    this.phase = 'reading'; this.base = from; this.t0 = Date.now(); this.endAt = 0;
    this.cast({ t: 'read', i: this.qi, shown: from, fresh: !!fresh });
  }
  onTick() {
    const now = Date.now();
    if (this.phase === 'reading') {
      const s = this.shown();
      if (s >= this.Q.q.length) { if (!this.endAt) this.endAt = now; else if (now - this.endAt > IDLE_MS) return this.reveal(); }
      for (const p of this.plans) {
        if (this.locked.has(p.i)) continue;
        if (s >= p.at) { p.delay -= TICK_MS / 1000; if (p.delay <= 0) { this.buzz(p.i); break; } }
      }
    } else if (this.phase === 'answering') {
      const t = (now - this.ansT0) / 1000, seat = this.seats[this.buzzer];
      if (!seat.cl) { // CPUの解答
        const want = Math.floor(Math.max(0, t - .8) / .55);
        if (want > this.ansPos) {
          if (this.ansPos === this.wrongAt) return this.judge(false);
          this.ansPos++; this.cast({ t: 'char', seat: this.buzzer, pos: this.ansPos, ch: this.Q.y[this.ansPos - 1] });
          if (this.ansPos >= this.Q.y.length) return this.judge(true);
        }
      } else if (t > ansLimit(this.Q.y) + 1) this.judge(false);   // 通信の遅れのぶん1秒おまけ
    }
  }
  buzz(i) {
    if (this.phase !== 'reading' || this.locked.has(i) || i < 0) return;
    this.base = this.shown(); this.phase = 'answering'; this.buzzer = i; this.ansPos = 0; this.ansT0 = Date.now();
    if (!this.seats[i].cl) { const p = this.plans.find(x => x.i === i); const okAns = Math.random() < (p ? p.skill : .7); this.wrongAt = okAns ? 99 : Math.floor(Math.random() * this.Q.y.length); }
    this.cast({ t: 'buzzed', seat: i, shown: this.base });
  }
  char(i, ch) {
    if (this.phase !== 'answering' || this.buzzer !== i) return;
    if (ch !== this.Q.y[this.ansPos]) return this.judge(false);
    this.ansPos++;
    if (this.ansPos >= this.Q.y.length) return this.judge(true);
    this.cast({ t: 'char', seat: i, pos: this.ansPos, ch });
  }
  judge(ok) {
    const i = this.buzzer; this.phase = 'judge';
    if (ok) this.scores[i] += 10; else { this.scores[i] -= 5; this.locked.add(i); }
    this.cast({ t: 'judge', seat: i, ok });
    this.later(ok ? JUDGE_OK_MS : JUDGE_NG_MS, () => { if (ok || this.locked.size >= 4) this.reveal(); else this.read(this.base, false); });
  }
  reveal() {
    this.phase = 'reveal'; this.cast({ t: 'reveal' });
    this.later(REVEAL_MS, () => { if (this.qi + 1 >= this.questions.length) this.end(); else this.intro(this.qi + 1); });
  }
  end() { this.cast({ t: 'end', scores: this.scores }); this.stop(); }
  stop() {
    this.over = true; clearInterval(this.tick); this.timers.forEach(t => clearTimeout(t));
    this.seats.forEach(s => { if (s.cl) { s.cl.game = null; s.cl.seat = -1; } });
    this.hub.gameOver(this);
  }
  playerGone(i) {
    const s = this.seats[i]; s.gone = true; s.cl = null; if (this.locked) this.locked.add(i);
    if (this.seats.every(x => !x.cl)) return this.stop();       // 人がいなくなったら終わり
    if (this.phase === 'answering' && this.buzzer === i) this.judge(false);
  }
}
