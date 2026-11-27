// 対戦の「通信」と、ゲームとサーバーの両方で使うルールをまとめた場所。
// SERVER_URL が空なら LocalNet（CPUを本物の相手のように見せる）で動く。
// Cloudflare のサーバー（server/ フォルダ）を出したら、SERVER_URL にその住所を入れるだけで本物の人と遊べる。
//
// ── サーバーとのやりとり（WebSocket, JSON） ─────────────────────────
// こちら → サーバー
//   {t:'hello', name, rp}            接続したら最初に送る
//   {t:'find'} / {t:'cancel'}        ランクマッチを探す／やめる
//   {t:'create', n}                  ルームを作る（n=問題数）
//   {t:'join', code}                 ルームに入る
//   {t:'addbot'} / {t:'start', n, qd}  ルームの主：CPUを入れる／スタート（qd=むずかしさ -1:おまかせ 0〜4）
//   {t:'leave'}                      ルームから出る
//   {t:'buzz'}                       ボタンを押した
//   {t:'char', ch}                   解答の1文字
// サーバー → こちら
//   {t:'search', sec, range, players}        探している途中
//   {t:'room', code, players, host}          ルームの中身（players は全員、host=自分が主か）
//   {t:'error', msg}                         エラー
//   {t:'begin', mode, seat, players, questions}  試合開始（seat=サーバーでの自分の席）
//   {t:'intro', i}                           i問目の「第○問」
//   {t:'read', i, shown, fresh}              読み上げ開始／再開（shown=何文字目から）
//   {t:'buzzed', seat, shown}                だれかが一番に押した（判定はサーバー）
//   {t:'char', seat, pos, ch}                正しい1文字（pos=何文字目まで正解）
//   {t:'judge', seat, ok}                    正解／不正解
//   {t:'reveal'}                             答えを見せる
//   {t:'end', scores}                        試合終了
// ──────────────────────────────────────────────────────

export const TIERS = ['ビギナー', 'ブロンズ', 'シルバー', 'ゴールド', 'マスター'];
export const SUBS = ['Ⅰ', 'Ⅱ', 'Ⅲ'];
export const TIER_COLORS = ['#9fd8a8', '#d8915a', '#cfd6e4', '#ffcc33', '#c58bff'];
export const RP_PER = 100;               // ひとつ上がるのに必要なポイント
export const MAX_IDX = TIERS.length * 3 - 1;
export function rankIdx(rp) { return Math.max(0, Math.min(MAX_IDX, Math.floor(rp / RP_PER))); }
export function tierOf(rp) { return Math.floor(rankIdx(rp) / 3); }
export function rankName(rp) { const i = rankIdx(rp); return TIERS[Math.floor(i / 3)] + SUBS[i % 3]; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 探し始めてからの秒数で、マッチングするランクの範囲をひろげる
//  〜10秒: 同じランク（ブロンズⅠ〜Ⅲは同じ）  〜20秒: となりのランクまで  それ以降: だれとでも
export function searchRange(tier, sec) {
  const w = sec < 10 ? 0 : sec < 20 ? 1 : TIERS.length;
  return [Math.max(0, tier - w), Math.min(TIERS.length - 1, tier + w)];
}
export const BOT_FILL_SEC = 30;          // これだけ待っても4人そろわなければCPUで埋める

// ランク帯ごとの「問題レベルの混ぜ方」（%）。レベル: 1かんたん 2ふつう 3ややむずかしい 4むずかしい 5難問 6超難問
export const LV_MIX = [
  [10, 40, 35, 15, 0, 0],  // ビギナー
  [0, 15, 40, 35, 10, 0],  // ブロンズ
  [0, 0, 20, 40, 30, 10],  // シルバー
  [0, 0, 0, 20, 45, 35],   // ゴールド
  [0, 0, 0, 0, 25, 75],    // マスター（ほぼ超難問）
];
// 部屋の中でいちばん低いランク帯〜高いランク帯の混ぜ方を平均して使う
export function mixForTiers(lo, hi) {
  const w = [0, 0, 0, 0, 0, 0];
  for (let t = lo; t <= hi; t++) LV_MIX[t].forEach((v, k) => w[k] += v / (hi - lo + 1));
  return w;
}
// CPUの強さ（0〜1）から、押す確率・押す位置・正解率などを決める
export function botParams(st) {
  const x = clamp(st, 0, 1);
  return { prob: .35 + .55 * x, from: .8 - .5 * x, span: .3 + .15 * x, skill: .55 + .37 * x, delay: [.4 - .32 * x, .75 - .45 * x] };
}
export function rankStrength(rp) { return .1 + rankIdx(rp) / MAX_IDX * .65; }
export function ansLimit(y) { return Math.max(10, 3 + y.length * 1.3); }   // 解答の制限時間（秒）
export const CHARS_PER_SEC = 8;
// 進行の待ち時間（秒）。ゲームとサーバーで同じ値を使う
export const T = { ready: 1.2, intro: 1.3, judgeOk: 2.0, judgeNg: 1.6, revealAfterOk: 1.0, reveal: 2.4, idle: 5 };
// CPUがまちがえるときに書く文字（正解の文字とちがうもの）
const KANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわんがぎぐげござじずぜぞだでどばびぶべぼ';
export function wrongChar(c) { if (/[A-Z]/.test(c)) { let z; do { z = String.fromCharCode(65 + Math.floor(Math.random() * 26)); } while (z === c); return z; } let x; do { x = KANA[Math.floor(Math.random() * KANA.length)]; } while (x === c); return /[0-9]/.test(c) ? String((+c + 1 + Math.floor(Math.random() * 8)) % 10) : x; }

export const BOT_NAMES = ['ハルト', 'ミサキ', 'ケンジ', 'ユイ', 'ソウタ', 'アオイ', 'リク', 'ヒナ', 'タクミ', 'サクラ', 'カイト', 'メイ', 'レン', 'ナナ',
  'ゆうき', 'かな', 'しょう', 'みお', 'だいち', 'あかり', 'Q王', 'はやおし太郎', 'ひらめき', 'クイズ好き', 'こたろう', 'まひろ', 'つばさ', 'りん'];
const rnd = Math.random;
export function botName(used) { let n; do { n = BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)]; } while (used.has(n)); used.add(n); return n; }
export function botRpInTier(t) { return t * 3 * RP_PER + Math.floor(rnd() * 3 * RP_PER); }

// ── サーバーなしで動く版 ──
export class LocalNet {
  constructor() { this.online = false; this.timer = null; }
  // ランクマッチ: 1秒ごとに onUpdate({sec, range, players})、そろったら onFound(players)
  findMatch(me, onUpdate, onFound) {
    const tier = tierOf(me.rp), used = new Set([me.name]), players = [];
    let sec = 0; const arriveAt = [1 + rnd() * 4, 3 + rnd() * 8, 5 + rnd() * 14].sort((a, b) => a - b);
    const step = () => {
      const range = searchRange(tier, sec);
      while (players.length < 3 && sec >= arriveAt[players.length]) {
        const t = range[0] + Math.floor(rnd() * (range[1] - range[0] + 1));
        players.push({ name: botName(used), rp: botRpInTier(t), bot: true });
      }
      onUpdate({ sec, range, players: [...players] });
      if (players.length >= 3) { this.timer = setTimeout(() => onFound(players), 900); return; }
      sec++; this.timer = setTimeout(step, 1000);
    };
    step();
  }
  cancel() { clearTimeout(this.timer); }
  // ルーム戦
  createRoom(me) { return { code: String(1000 + Math.floor(rnd() * 9000)), host: true, players: [] }; }
  joinRoom() { return Promise.reject(new Error('まだサーバーにつながっていないので、友達の部屋には入れません。今は「部屋を作る」→「CPUを入れる」で遊べます')); }
  addBot(room, me) {
    const used = new Set([me.name, ...room.players.map(p => p.name)]);
    const t = tierOf(me.rp), tt = Math.max(0, Math.min(TIERS.length - 1, t + Math.floor(rnd() * 3) - 1));
    const p = { name: botName(used), rp: botRpInTier(tt), bot: true }; room.players.push(p); return p;
  }
  on() {}
  send() {}
  leaveRoom() {}
}

// ── Cloudflare のサーバーにつなぐ版 ──
export class CloudNet {
  constructor(url) { this.url = url; this.online = true; this.ws = null; this.h = {}; this.ready = null; }
  on(t, fn) { this.h[t] = fn; }
  emit(t, m) { (this.h[t] || (() => {}))(m); }
  connect(me) {
    if (this.ready) { this.ready.then(() => this.send({ t: 'hello', name: me.name, rp: me.rp })).catch(() => {}); return this.ready; }
    this.ready = new Promise((res, rej) => {
      let opened = false;
      const ws = this.ws = new WebSocket(this.url);
      ws.onopen = () => { opened = true; this.send({ t: 'hello', name: me.name, rp: me.rp }); res(); };
      ws.onerror = () => { if (!opened) rej(new Error('サーバーにつながりませんでした。少し待ってからもう一度ためしてね')); };
      ws.onclose = () => { this.ready = null; this.ws = null; if (opened) this.emit('close', {}); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } this.emit(m.t, m); };
    });
    this.ready.catch(() => { this.ready = null; });
    return this.ready;
  }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  // ランクマッチ（そろったらサーバーから begin が来る）
  findMatch(me, onUpdate) {
    this.h.search = m => onUpdate({ sec: m.sec, range: m.range, players: m.players });
    this.connect(me).then(() => this.send({ t: 'find' })).catch(e => onUpdate({ error: e.message }));
  }
  cancel() { this.send({ t: 'cancel' }); }
  // ルーム戦（中身はサーバーから room で届く）
  createRoom(me, n) { return this.connect(me).then(() => this.send({ t: 'create', n })); }
  joinRoom(me, code) { return this.connect(me).then(() => this.send({ t: 'join', code })); }
  addBot() { this.send({ t: 'addbot' }); }
  startRoom(n, qd) { this.send({ t: 'start', n, qd }); }
  leaveRoom() { this.send({ t: 'leave' }); }
}

// サーバーの住所（例: 'wss://hayaoshi-server.あなたの名前.workers.dev/ws'）。空ならサーバーなしで動く
// ページの住所に ?server=wss://... をつけると、その住所を試せる
export const SERVER_URL = 'wss://hayaoshi-server.yuchin08092010.workers.dev/ws';
export function makeNet() {
  let url = SERVER_URL;
  try { const q = new URLSearchParams(location.search).get('server'); if (q && /^wss?:\/\//.test(q)) url = q; } catch (e) {}
  return url ? new CloudNet(url) : new LocalNet();
}
