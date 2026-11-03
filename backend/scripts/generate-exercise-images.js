/**
 * Generates illustrated PNG images for the seeded exercises, workouts, recipes and articles
 * into public/images/*. Admins can replace any of them with real photos from the admin panel.
 *   npm run images
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { EXERCISES } from '../src/seed-data/exercises.js';
import { WORKOUTS } from '../src/seed-data/workouts.js';
import { RECIPES, ARTICLES } from '../src/seed-data/content.js';
import { PUBLIC_DIR } from '../src/paths.js';

const THEME = {
  cardio: ['#fb7185', '#f97316'],
  strength: ['#6366f1', '#0ea5e9'],
  hiit: ['#ef4444', '#a855f7'],
  yoga: ['#14b8a6', '#22c55e'],
  stretching: ['#f59e0b', '#84cc16'],
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function figure(p, { dx = 0, dy = 0, scale = 1, color = '#fff' } = {}) {
  const t = ([x, y]) => [dx + x * scale, dy + y * scale];
  const line = (a, b) => {
    const [x1, y1] = t(a);
    const [x2, y2] = t(b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  };
  const [hx, hy] = t(p.h);
  return `<g stroke="${color}" stroke-width="${9 * scale}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${line(p.n, p.p)}${line(p.n, p.el)}${line(p.el, p.hl)}${line(p.n, p.er)}${line(p.er, p.hr)}
    ${line(p.p, p.kl)}${line(p.kl, p.fl)}${line(p.p, p.kr)}${line(p.kr, p.fr)}
  </g><circle cx="${hx}" cy="${hy}" r="${12 * scale}" fill="${color}"/>`;
}

function prop(ex, { dx = 0, dy = 0, scale = 1 } = {}) {
  const s = (v) => v * scale;
  if (ex.prop === 'wall') return `<rect x="${dx + s(44)}" y="${dy + s(20)}" width="${s(14)}" height="${s(160)}" rx="${s(3)}" fill="#ffffff55"/>`;
  if (ex.prop === 'rope') return `<path d="M${dx + s(74)} ${dy + s(100)} C ${dx + s(40)} ${dy + s(-20)}, ${dx + s(160)} ${dy + s(-20)}, ${dx + s(126)} ${dy + s(100)}" stroke="#fde68a" stroke-width="${s(3)}" fill="none"/>`;
  if (ex.prop === 'circles') return `<g stroke="#fde68a" stroke-width="${s(3)}" fill="none"><circle cx="${dx + s(52)}" cy="${dy + s(56)}" r="${s(12)}"/><circle cx="${dx + s(148)}" cy="${dy + s(56)}" r="${s(12)}"/></g>`;
  return '';
}

function exerciseSvg(ex) {
  const [a, b] = THEME[ex.category];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 200 200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="200" height="200" fill="url(#g)"/>
  <circle cx="160" cy="36" r="56" fill="#ffffff14"/><circle cx="30" cy="190" r="40" fill="#ffffff10"/>
  <rect x="0" y="180" width="200" height="20" fill="#00000022"/>
  ${prop(ex)}${figure(ex.pose)}
  </svg>`;
}

function wrap(text, max) {
  const words = text.split(' ');
  const lines = [''];
  for (const w of words) {
    if ((lines.at(-1) + ' ' + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim();
  }
  return lines;
}

function coverSvg({ title, subtitle, colors, art }) {
  const [a, b] = colors;
  const lines = wrap(title, 22).slice(0, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 600 338">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="600" height="338" fill="url(#g)"/>
  <circle cx="520" cy="40" r="140" fill="#ffffff14"/><circle cx="330" cy="360" r="110" fill="#ffffff10"/>
  ${art}
  <g font-family="DejaVu Sans, Arial, sans-serif" fill="#fff">
    <text x="32" y="44" font-size="15" font-weight="700" letter-spacing="3" opacity=".85">NALAM</text>
    ${lines.map((l, i) => `<text x="32" y="${118 + i * 38}" font-size="32" font-weight="700">${esc(l)}</text>`).join('')}
    <text x="32" y="${118 + lines.length * 38 + 6}" font-size="17" opacity=".9">${esc(subtitle)}</text>
  </g></svg>`;
}

const bySlug = Object.fromEntries(EXERCISES.map((e) => [e.slug, e]));

function workoutArt(w) {
  const poses = [...new Set(w.exercises.map((e) => e[0]))].slice(0, 2).map((s) => bySlug[s]);
  return `<rect x="0" y="300" width="600" height="38" fill="#00000022"/>` +
    poses.map((ex, i) => prop(ex, { dx: 330 + i * 125, dy: 138, scale: 0.9 }) + figure(ex.pose, { dx: 330 + i * 125, dy: 138, scale: 0.9 })).join('');
}

function plateArt(seed) {
  const colors = ['#facc15', '#22c55e', '#ef4444', '#f97316', '#a3e635', '#fde68a'];
  let dots = '';
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + seed;
    const r = 30 + ((i * 37 + seed * 11) % 40);
    dots += `<circle cx="${450 + Math.cos(ang) * r}" cy="${190 + Math.sin(ang) * r * 0.8}" r="${10 + (i % 3) * 4}" fill="${colors[(i + seed) % colors.length]}"/>`;
  }
  return `<ellipse cx="450" cy="200" rx="120" ry="100" fill="#fff"/><ellipse cx="450" cy="195" rx="92" ry="76" fill="#fef3c7"/>${dots}`;
}

function articleArt(i) {
  const icons = [
    '<path d="M450 110 a70 70 0 1 0 1 0" fill="#ffffff33"/><text x="410" y="220" font-size="90" fill="#fff" font-family="DejaVu Sans">%</text>',
    '<g fill="#ffffffaa"><ellipse cx="420" cy="190" rx="20" ry="50"/><ellipse cx="470" cy="180" rx="20" ry="60"/><ellipse cx="520" cy="195" rx="20" ry="45"/></g>',
    '<path d="M470 110 a70 70 0 1 0 50 120 a55 55 0 1 1 -50 -120z" fill="#fef9c3"/>',
    figure(bySlug['high-knees'].pose, { dx: 380, dy: 110, scale: 1.05 }),
    '<path d="M460 100 C 420 170, 400 200, 420 240 A 45 45 0 0 0 500 240 C 520 200, 500 170, 460 100z" fill="#e0f2fe"/>',
  ];
  return icons[i % icons.length];
}

async function write(dir, name, svg, width) {
  await fs.mkdir(path.join(PUBLIC_DIR, 'images', dir), { recursive: true });
  await sharp(Buffer.from(svg)).resize({ width }).png({ compressionLevel: 9, palette: true }).toFile(path.join(PUBLIC_DIR, 'images', dir, `${name}.png`));
}

export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const ex of EXERCISES) await write('exercises', ex.slug, exerciseSvg(ex), 480);
for (const w of WORKOUTS) {
  await write('workouts', w.slug, coverSvg({ title: w.title, subtitle: `${w.duration_min} min · ${w.difficulty}`, colors: THEME[w.category], art: workoutArt(w) }), 960);
}
for (const [i, r] of RECIPES.entries()) {
  await write('recipes', slugify(r.title), coverSvg({ title: r.title, subtitle: `${r.calories} kcal · ${r.prep_min} min`, colors: ['#16a34a', '#65a30d'], art: plateArt(i) }), 960);
}
const articleColors = [['#0ea5e9', '#6366f1'], ['#ca8a04', '#65a30d'], ['#4338ca', '#1e1b4b'], ['#f97316', '#ef4444'], ['#06b6d4', '#2563eb']];
for (const [i, a] of ARTICLES.entries()) {
  await write('articles', slugify(a.title), coverSvg({ title: a.title, subtitle: a.category, colors: articleColors[i % 5], art: articleArt(i) }), 960);
}
console.log(`Generated ${EXERCISES.length} exercise, ${WORKOUTS.length} workout, ${RECIPES.length} recipe and ${ARTICLES.length} article images in public/images`);
