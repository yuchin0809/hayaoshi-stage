// 対戦の「通信」をまとめた場所。
// いまはサーバーがないので LocalNet（CPUを本物の相手のように見せる）で動く。
// Cloudflare のサーバーができたら、CloudNet の URL を入れるだけで本物の人と遊べるようにしてある。
//
// ── サーバーとのやりとり（WebSocket, JSON） ─────────────────────────
// こちら → サーバー
//   {t:'hello', name, rp}                         … 接続したら最初に送る
//   {t:'find'}                                    … ランクマッチを探す
//   {t:'cancel'}                                  … 探すのをやめる
//   {t:'create', n}                               … ルームを作る（n=問題数）
//   {t:'join', code}                              … ルームに入る
//   {t:'start'}                                   … ルームの主がスタート
//   {t:'buzz', at}                                … ボタンを押した（at=押した時刻）
//   {t:'char', ch}                                … 解答の1文字
// サーバー → こちら
//   {t:'search', sec, range:[lo,hi]}              … 探している途中（範囲がひろがる）
//   {t:'joined', players:[{name,rp}], seat}       … 部屋のメンバーが変わった
//   {t:'room', code, host}                        … ルームの番号
//   {t:'begin', questions:[{q,a,y,lv}], players}  … 試合開始
//   {t:'qstart', i}                               … i問目の読み上げ開始
//   {t:'buzzed', seat}                            … だれかが一番に押した（判定はサーバー）
//   {t:'char', seat, ch, ok}                      … 解答の1文字と正誤
//   {t:'judge', seat, ok}                         … 正解／不正解
//   {t:'end', scores, rp}                         … 試合終了とランクの変化
// ──────────────────────────────────────────────────────

export const TIERS = ['ビギナー', 'ブロンズ', 'シルバー', 'ゴールド', 'マスター'];
export const SUBS = ['Ⅰ', 'Ⅱ', 'Ⅲ'];
export const TIER_COLORS = ['#9fd8a8', '#d8915a', '#cfd6e4', '#ffcc33', '#c58bff'];
export const RP_PER = 100;               // ひとつ上がるのに必要なポイント
export const MAX_IDX = TIERS.length * 3 - 1;
export function rankIdx(rp) { return Math.max(0, Math.min(MAX_IDX, Math.floor(rp / RP_PER))); }
export function tierOf(rp) { return Math.floor(rankIdx(rp) / 3); }
export function rankName(rp) { const i = rankIdx(rp); return TIERS[Math.floor(i / 3)] + SUBS[i % 3]; }

// 探し始めてからの秒数で、マッチングするランクの範囲をひろげる
//  〜10秒: 同じランク（ブロンズⅠ〜Ⅲは同じ）  〜20秒: となりのランクまで  それ以降: だれとでも
export function searchRange(tier, sec) {
  const w = sec < 10 ? 0 : sec < 20 ? 1 : TIERS.length;
  return [Math.max(0, tier - w), Math.min(TIERS.length - 1, tier + w)];
}

const BOT_NAMES = ['ハルト', 'ミサキ', 'ケンジ', 'ユイ', 'ソウタ', 'アオイ', 'リク', 'ヒナ', 'タクミ', 'サクラ', 'カイト', 'メイ', 'レン', 'ナナ',
  'ゆうき', 'かな', 'しょう', 'みお', 'だいち', 'あかり', 'Q王', 'はやおし太郎', 'ひらめき', 'クイズ好き', 'こたろう', 'まひろ', 'つばさ', 'りん'];
const rnd = Math.random;
function botName(used) { let n; do { n = BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)]; } while (used.has(n)); used.add(n); return n; }
function botRpInTier(t) { return t * 3 * RP_PER + Math.floor(rnd() * 3 * RP_PER); }

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
  joinRoom(code) { return Promise.reject(new Error('まだサーバーにつながっていないので、友達の部屋には入れません。今は「部屋を作る」→「CPUを入れる」で遊べます')); }
  addBot(room, me) {
    const used = new Set([me.name, ...room.players.map(p => p.name)]);
    const t = tierOf(me.rp), tt = Math.max(0, Math.min(TIERS.length - 1, t + Math.floor(rnd() * 3) - 1));
    const p = { name: botName(used), rp: botRpInTier(tt), bot: true }; room.players.push(p); return p;
  }
}

// ── Cloudflare のサーバーにつなぐ版（サーバーができたら使う） ──
export class CloudNet {
  constructor(url) { this.url = url; this.online = true; this.ws = null; this.on = {}; }
  connect(me) {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => { this.send({ t: 'hello', name: me.name, rp: me.rp }); res(); };
      this.ws.onerror = rej;
      this.ws.onmessage = e => { const m = JSON.parse(e.data); (this.on[m.t] || (() => {}))(m); };
    });
  }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  // LocalNet と同じ形で使えるようにしてある
  findMatch(me, onUpdate, onFound) {
    this.on.search = m => onUpdate({ sec: m.sec, range: m.range, players: this._players || [] });
    this.on.joined = m => { this._players = m.players.filter((_, i) => i !== m.seat); onUpdate({ sec: 0, range: [0, 0], players: this._players }); };
    this.on.begin = m => onFound(m.players.filter(p => p.name !== me.name), m.questions);
    this.connect(me).then(() => this.send({ t: 'find' }));
  }
  cancel() { this.send({ t: 'cancel' }); }
  createRoom(me) { this.connect(me).then(() => this.send({ t: 'create', n: 10 })); return { code: '----', host: true, players: [] }; }
  joinRoom(code) { return new Promise((res, rej) => { this.on.joined = m => res(m); this.on.error = m => rej(new Error(m.msg)); this.send({ t: 'join', code }); }); }
  addBot() { return null; }
}

// サーバーの住所（できたらここに入れる。空ならサーバーなしで動く）
export const SERVER_URL = '';
export function makeNet() { return SERVER_URL ? new CloudNet(SERVER_URL) : new LocalNet(); }
