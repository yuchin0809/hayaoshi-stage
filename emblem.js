// ランクのマーク（SVG）。ビギナー＝若葉、ブロンズ＝稲妻の盾、シルバー＝翼の盾、ゴールド＝王冠と月桂樹、マスター＝炎のクリスタル。
// Ⅰ〜Ⅲは下のリボンに書く。
import { rankIdx, SUBS } from './net.js';

let uid = 0;
const PAL = [
  ['#d9ffd0', '#5fcf6e', '#1f6b35'],   // ビギナー
  ['#ffd2a6', '#c9773d', '#5e2e10'],   // ブロンズ
  ['#ffffff', '#b9c3d6', '#4d5870'],   // シルバー
  ['#fff3b0', '#f2b81f', '#7a4f00'],   // ゴールド
  ['#ffd6ff', '#a54dff', '#2a0a5e'],   // マスター
];
const SHIELD = 'M50 10 L82 22 L80 54 Q76 78 50 92 Q24 78 20 54 L18 22 Z';

export function emblemSVG(rp, size = 64) {
  const i = rankIdx(rp), t = Math.floor(i / 3), s = i % 3, [hi, mid, lo] = PAL[t], id = 'e' + (++uid);
  const g = `<defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="${id}c" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${mid}" stop-opacity=".9"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient>
  </defs>`;
  const F = `fill="url(#${id}a)" stroke="${lo}" stroke-width="2.5" stroke-linejoin="round"`;
  let body = '';
  if (t === 0) {
    body = `<polygon points="50,12 84,31 84,69 50,88 16,69 16,31" ${F}/>
      <polygon points="50,12 84,31 84,50 16,50 16,31" fill="url(#${id}b)"/>
      <path d="M50 74 V48" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 52 Q30 50 28 32 Q46 32 50 52 Z" fill="#fff"/><path d="M50 46 Q66 44 72 28 Q54 26 50 46 Z" fill="#fff" opacity=".85"/>`;
  } else if (t === 1) {
    body = `<path d="${SHIELD}" ${F}/><path d="M50 10 L82 22 L81 40 L19 40 L18 22 Z" fill="url(#${id}b)"/>
      <path d="M56 22 L36 54 H50 L42 80 L66 44 H52 Z" fill="#fff" stroke="${lo}" stroke-width="2" stroke-linejoin="round"/>`;
  } else if (t === 2) {
    const wing = d => `<path d="M${50 + d * 22} 40 Q${50 + d * 46} 30 ${50 + d * 48} 16 Q${50 + d * 44} 44 ${50 + d * 24} 60 Z" ${F}/>
      <path d="M${50 + d * 26} 48 Q${50 + d * 40} 42 ${50 + d * 44} 30" stroke="${lo}" stroke-width="1.6" fill="none"/>`;
    body = wing(-1) + wing(1) + `<path d="${SHIELD}" transform="translate(50 52) scale(.72) translate(-50 -52)" ${F}/>
      <path d="M50 30 L55 44 L70 44 L58 53 L62 68 L50 59 L38 68 L42 53 L30 44 L45 44 Z" fill="#fff" stroke="${lo}" stroke-width="1.6" stroke-linejoin="round"/>`;
  } else if (t === 3) {
    const leaves = d => [0, 1, 2, 3, 4].map(k => {
      const a = (200 - k * 26) * Math.PI / 180, x = 50 + d * Math.cos(a) * -34, y = 56 - Math.sin(a) * 34;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="3.6" transform="rotate(${(d * (k * 26 - 20)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${id}a)" stroke="${lo}" stroke-width="1.4"/>`;
    }).join('');
    body = leaves(1) + leaves(-1) + `<path d="${SHIELD}" transform="translate(50 56) scale(.66) translate(-50 -52)" ${F}/>
      <path d="M30 26 L36 8 L44 20 L50 4 L56 20 L64 8 L70 26 Z" ${F}/><circle cx="50" cy="4" r="3" fill="#fff"/>
      <path d="M50 38 L54.5 50 L67 50 L57 57.5 L60.5 70 L50 62.5 L39.5 70 L43 57.5 L33 50 L45.5 50 Z" fill="#fff" stroke="${lo}" stroke-width="1.6" stroke-linejoin="round"/>`;
  } else {
    const rays = [...Array(12)].map((_, k) => `<path d="M50 50 L${(50 + 48 * Math.cos((k * 30 - 4) * Math.PI / 180)).toFixed(1)} ${(50 + 48 * Math.sin((k * 30 - 4) * Math.PI / 180)).toFixed(1)} L${(50 + 48 * Math.cos((k * 30 + 4) * Math.PI / 180)).toFixed(1)} ${(50 + 48 * Math.sin((k * 30 + 4) * Math.PI / 180)).toFixed(1)} Z" fill="${hi}" opacity=".35"/>`).join('');
    body = `<circle cx="50" cy="50" r="48" fill="url(#${id}c)"/>${rays}
      <path d="M50 14 Q60 28 58 40 Q68 30 66 18 Q82 36 72 62 L28 62 Q18 36 34 18 Q32 30 42 40 Q40 28 50 14 Z" fill="#ff7ae0" opacity=".85" stroke="${lo}" stroke-width="2"/>
      <polygon points="50,26 74,48 50,88 26,48" ${F}/><polygon points="50,26 74,48 50,52 26,48" fill="url(#${id}b)"/>
      <path d="M26 48 H74 M50 26 L40 48 L50 88 L60 48 Z" stroke="${lo}" stroke-width="1.5" fill="none" opacity=".7"/>
      <path d="M36 24 L40 12 L46 20 L50 8 L54 20 L60 12 L64 24 Z" fill="#ffe36b" stroke="#7a4f00" stroke-width="2" stroke-linejoin="round"/>`;
  }
  const ribbon = `<path d="M22 88 H78 L74 95 L78 102 H22 L26 95 Z" transform="translate(0 -6)" fill="${lo}" stroke="${hi}" stroke-width="1.5"/>
    <text x="50" y="94.5" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="serif">${SUBS[s]}</text>`;
  return `<svg viewBox="0 -2 100 104" width="${size}" height="${size}" style="display:block;overflow:visible;filter:drop-shadow(0 0 ${t === 4 ? 6 : 3}px ${mid})">${g}${body}${ribbon}</svg>`;
}
