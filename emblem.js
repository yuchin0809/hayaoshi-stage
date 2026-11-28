// ランクのマーク（SVG）。ビギナー＝若葉、ブロンズ＝稲妻の盾、シルバー＝翼の盾、プラチナ＝氷のダイヤ、ゴールド＝王冠と月桂樹、マスター＝炎の翼と王冠のクリスタル（光がまわる）。
// Ⅰ〜Ⅲは下のリボンに書く。
import { rankIdx, SUBS } from './net.js';

let uid = 0;
const PAL = [
  ['#d9ffd0', '#5fcf6e', '#1f6b35'],   // ビギナー
  ['#ffd2a6', '#c9773d', '#5e2e10'],   // ブロンズ
  ['#ffffff', '#b9c3d6', '#4d5870'],   // シルバー
  ['#f2ffff', '#6fdcf0', '#0f5566'],   // プラチナ
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
    const fin = d => `<path d="M${50 + d * 20} 34 L${50 + d * 46} 22 L${50 + d * 36} 44 L${50 + d * 44} 50 L${50 + d * 24} 62 Z" ${F}/>
      <path d="M${50 + d * 24} 40 L${50 + d * 40} 30" stroke="#fff" stroke-width="1.6" opacity=".7"/>`;
    const sp = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28} Z" fill="#fff"/>`;
    body = fin(-1) + fin(1) + `<path d="M50 8 L80 24 L76 60 L50 90 L24 60 L20 24 Z" ${F}/>
      <path d="M50 8 L80 24 L78 42 L22 42 L20 24 Z" fill="url(#${id}b)"/>
      <polygon points="50,28 66,40 50,74 34,40" fill="#fff" stroke="${lo}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M34 40 H66 M50 28 L43 40 L50 74 L57 40 Z" stroke="${mid}" stroke-width="1.4" fill="none"/>
      <polygon points="50,28 57,40 43,40" fill="${hi}"/>` + sp(30, 20, 6) + sp(72, 70, 5) + sp(68, 16, 3.5);
  } else if (t === 4) {
    const leaves = d => [0, 1, 2, 3, 4].map(k => {
      const a = (200 - k * 26) * Math.PI / 180, x = 50 + d * Math.cos(a) * -34, y = 56 - Math.sin(a) * 34;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="3.6" transform="rotate(${(d * (k * 26 - 20)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${id}a)" stroke="${lo}" stroke-width="1.4"/>`;
    }).join('');
    body = leaves(1) + leaves(-1) + `<path d="${SHIELD}" transform="translate(50 56) scale(.66) translate(-50 -52)" ${F}/>
      <path d="M30 26 L36 8 L44 20 L50 4 L56 20 L64 8 L70 26 Z" ${F}/><circle cx="50" cy="4" r="3" fill="#fff"/>
      <path d="M50 38 L54.5 50 L67 50 L57 57.5 L60.5 70 L50 62.5 L39.5 70 L43 57.5 L33 50 L45.5 50 Z" fill="#fff" stroke="${lo}" stroke-width="1.6" stroke-linejoin="round"/>`;
  } else {
    // マスター：まわる光・炎の翼・八方の星・王冠つきのクリスタル
    const rays = [...Array(16)].map((_, k) => { const a = k * 22.5 * Math.PI / 180, w = (k % 2 ? 3 : 6) * Math.PI / 180, R = k % 2 ? 44 : 54;
      return `<path d="M50 48 L${(50 + R * Math.cos(a - w)).toFixed(1)} ${(48 + R * Math.sin(a - w)).toFixed(1)} L${(50 + R * Math.cos(a + w)).toFixed(1)} ${(48 + R * Math.sin(a + w)).toFixed(1)} Z" fill="${k % 2 ? '#ffe9a8' : hi}" opacity="${k % 2 ? .35 : .3}"/>`; }).join('');
    const star = [...Array(16)].map((_, k) => { const a = (k * 22.5 - 90) * Math.PI / 180, R = k % 2 ? 24 : 40; return `${(50 + R * Math.cos(a)).toFixed(1)},${(48 + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const wing = d => [2, 1, 0].map(k => {
      const x = v => (50 + d * v).toFixed(1);
      return `<path d="M${x(16)} ${28 + k * 11} Q${x(40 - k * 3)} ${12 + k * 13} ${x(60 - k * 7)} ${2 + k * 17} Q${x(46 - k * 4)} ${34 + k * 12} ${x(18)} ${42 + k * 11} Z" fill="url(#${id}w)" stroke="#ffd34d" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M${x(22)} ${34 + k * 11} Q${x(40 - k * 3)} ${24 + k * 13} ${x(54 - k * 7)} ${8 + k * 17}" stroke="#fff" stroke-width="1" fill="none" opacity=".55"/>`;
    }).join('');
    body = `<defs>
        <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6ff"/><stop offset=".35" stop-color="#ff5fd2"/><stop offset="1" stop-color="#5a12b8"/></linearGradient>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#ffc21a"/><stop offset="1" stop-color="#9a5a00"/></linearGradient>
        <linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1272"/><stop offset="1" stop-color="#12052e"/></linearGradient>
        <linearGradient id="${id}s" x1="-1" y1="0" x2="0" y2="0" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
          <animate attributeName="x1" values="-1;1.2;1.2" dur="3.2s" repeatCount="indefinite"/><animate attributeName="x2" values="0;2.2;2.2" dur="3.2s" repeatCount="indefinite"/></linearGradient>
      </defs>
      <circle cx="50" cy="48" r="50" fill="url(#${id}c)"><animate attributeName="r" values="46;54;46" dur="2.4s" repeatCount="indefinite"/></circle>
      <g>${rays}<animateTransform attributeName="transform" type="rotate" from="0 50 48" to="360 50 48" dur="18s" repeatCount="indefinite"/></g>
      ${wing(-1)}${wing(1)}
      <polygon points="${star}" fill="url(#${id}k)" stroke="url(#${id}g)" stroke-width="2.4" stroke-linejoin="round"/>
      <polygon points="50,20 70,34 70,62 50,80 30,62 30,34" fill="#1a0840" stroke="url(#${id}g)" stroke-width="2.6" stroke-linejoin="round"/>
      <polygon points="50,26 64,44 50,76 36,44" ${F}/>
      <polygon points="50,26 64,44 50,48 36,44" fill="url(#${id}b)"/>
      <path d="M36 44 H64 M50 26 L44 44 L50 76 L56 44 Z" stroke="${lo}" stroke-width="1.2" fill="none" opacity=".8"/>
      <polygon points="50,26 64,44 50,76 36,44" fill="url(#${id}s)"/>
      <path d="M33 22 L36 6 L43 15 L50 0 L57 15 L64 6 L67 22 Z" fill="url(#${id}g)" stroke="#6b3a00" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="33" y="20" width="34" height="5" rx="1.5" fill="url(#${id}g)" stroke="#6b3a00" stroke-width="1.4"/>
      <circle cx="50" cy="1" r="2.6" fill="#ff5fd2" stroke="#fff" stroke-width="1"/><circle cx="36" cy="7" r="1.8" fill="#7cf"/><circle cx="64" cy="7" r="1.8" fill="#7cf"/>
      <circle cx="50" cy="22.5" r="1.8" fill="#ff5fd2"/><circle cx="41" cy="22.5" r="1.3" fill="#fff"/><circle cx="59" cy="22.5" r="1.3" fill="#fff"/>
      <path d="M50 52 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="#fff"><animate attributeName="opacity" values="0;1;0" dur="1.6s" repeatCount="indefinite"/></path>`;
  }
  const ribbon = `<path d="M22 88 H78 L74 95 L78 102 H22 L26 95 Z" transform="translate(0 -6)" fill="${lo}" stroke="${t === 5 ? '#ffd34d' : hi}" stroke-width="${t === 5 ? 2 : 1.5}"/>
    <text x="50" y="94.5" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="serif">${SUBS[s]}</text>`;
  return `<svg viewBox="0 -2 100 104" width="${size}" height="${size}" style="display:block;overflow:visible;filter:drop-shadow(0 0 ${t === 5 ? 7 : 3}px ${mid})">${g}${body}${ribbon}</svg>`;
}
