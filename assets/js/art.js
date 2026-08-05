/*
 * Illustrations des Sprites.
 *
 * On affiche les vraies images du jeu (assets/sprites/<sprite>_<variante>.webp),
 * hébergées avec le site. `spriteSvg` reste utilisé comme repli si un fichier
 * manque : voir le gestionnaire d'erreur dans app.js.
 */

import { VARIANT_INDEX } from './data.js';

/** Résolu depuis l'URL du module, quel que soit le dossier de la page. */
const SPRITE_DIR = new URL('../sprites/', import.meta.url).href;

/**
 * Balise <img> pointant sur l'illustration officielle d'un Sprite.
 * @param {object} sprite entrée de SPRITES
 * @param {string} variant identifiant de variante
 * @param {number} size côté en pixels
 * @param {string} label texte alternatif
 */
export function spriteImg(sprite, variant = 'normal', size = 64, label = '') {
  // Sprite trop récent pour avoir son illustration : on dessine directement,
  // plutôt que de demander un fichier absent et de récolter un 404 à chaque
  // chargement. Retirer `noArt` dès que le .webp est ajouté.
  if (sprite.noArt) return spriteSvg(sprite, variant, size);

  return `<img class="sprite-img" src="${SPRITE_DIR}${sprite.id}_${variant}.webp"
    width="${size}" height="${size}" alt="${label}" loading="lazy" decoding="async"
    data-sprite="${sprite.id}" data-variant="${variant}" data-size="${size}">`;
}

const SHAPES = {
  drop: 'M32 8 C 44 24, 52 33, 52 41 a 20 20 0 0 1 -40 0 C 12 33, 20 24, 32 8 Z',
  leaf: 'M14 50 C 14 26, 30 12, 52 12 C 52 34, 38 50, 14 50 Z M14 50 C 24 40, 34 34, 46 30',
  flame:
    'M32 6 C 40 20, 50 26, 50 38 a 18 18 0 0 1 -36 0 C 14 30, 20 28, 24 20 C 26 28, 30 30, 32 6 Z',
  fish: 'M10 32 C 18 18, 40 18, 48 32 C 40 46, 18 46, 10 32 Z M48 32 L 58 22 L 58 42 Z',
  swirl:
    'M10 24 h 28 a 7 7 0 1 0 -7 -7 M10 34 h 36 a 8 8 0 1 1 -8 8 M10 44 h 20',
  duck: 'M20 44 a 14 14 0 1 1 14 -14 v 4 h 10 l -6 6 h -4 a 14 14 0 0 1 -14 4 Z M26 26 a 2 2 0 1 0 0.1 0',
  ghost:
    'M16 52 V 28 a 16 16 0 0 1 32 0 v 24 l -6 -5 l -5 5 l -5 -5 l -5 5 l -5 -5 Z',
  demon:
    'M18 16 L 12 6 L 24 12 M46 16 L 52 6 L 40 12 M32 12 a 18 18 0 0 1 18 18 c 0 12 -8 22 -18 22 s -18 -10 -18 -22 a 18 18 0 0 1 18 -18 Z',
  crown: 'M10 46 L 14 18 L 24 30 L 32 12 L 40 30 L 50 18 L 54 46 Z',
  orb: 'M32 32 m -20 0 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0 M32 32 m -11 0 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0',
  ball: 'M32 32 m -21 0 a 21 21 0 1 0 42 0 a 21 21 0 1 0 -42 0 M32 20 l 10 7 l -4 12 h -12 l -4 -12 Z',
  moon: 'M40 10 a 22 22 0 1 0 0 44 a 26 26 0 0 1 0 -44 Z',
  bolt: 'M36 6 L 16 36 h 12 l -6 22 l 22 -32 h -13 Z',
  shield: 'M32 8 L 52 16 v 16 c 0 12 -9 20 -20 24 c -11 -4 -20 -12 -20 -24 V 16 Z',
  seven: 'M18 16 h 28 l -16 40 h -10 l 14 -32 h -16 Z',
  banana: 'M18 12 c 0 22 10 34 30 38 c -6 6 -30 6 -36 -12 c -4 -12 0 -22 6 -26 Z',
  llama: 'M22 54 V 34 l -6 -6 l 4 -12 l 8 6 h 10 l 8 -6 l 4 12 l -6 6 v 20 Z M26 26 h 2 M38 26 h 2',
  bat: 'M6 22 c 10 -2 14 4 14 4 l 6 -8 h 12 l 6 8 s 4 -6 14 -4 c -6 6 -6 12 -4 16 c -8 -2 -14 2 -16 8 h -12 c -2 -6 -8 -10 -16 -8 c 2 -4 2 -10 -4 -16 Z',
  scythe:
    'M50 10 c -16 0 -28 10 -30 24 c 6 -10 16 -14 24 -12 c -6 4 -10 10 -10 16 L 22 56 h -6 L 44 22 c 4 -4 6 -8 6 -12 Z',
  zero: 'M32 32 m -22 0 a 22 22 0 1 0 44 0 a 22 22 0 1 0 -44 0 M32 32 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 M14 14 L 50 50',
  peanut:
    'M24 12 a 12 12 0 0 1 0 20 a 12 12 0 0 0 0 22 a 14 14 0 0 0 16 -14 a 12 12 0 0 1 0 -16 a 14 14 0 0 0 -16 -12 Z',
  chicken:
    'M28 22 a 14 14 0 1 1 14 16 v 12 h -18 v -12 a 14 14 0 0 1 4 -16 Z M30 12 l 2 -6 l 4 6 M24 26 h 2 M14 30 l -6 -4 l 8 -2',
  suit: 'M32 10 a 8 8 0 1 1 0 16 a 8 8 0 0 1 0 -16 Z M18 56 v -16 a 14 14 0 0 1 14 -12 a 14 14 0 0 1 14 12 v 16 Z M32 28 l -5 10 l 5 6 l 5 -6 Z',
};

/** Palettes appliquées par-dessus les couleurs du Sprite selon la variante. */
const VARIANT_PAINT = {
  normal: null,
  gold: ['#ffe487', '#c78d0a'],
  gummy: ['#ff9ecb', '#c23f8b'],
  galaxy: ['#8f6bff', '#1a1147'],
  gem: ['#7ff0e2', '#128f7f'],
  holofoil: ['#ffd6ff', '#66d8ff'],
  cube: ['#d07bff', '#4a0e73'],
  quack: ['#ffd24d', '#e07a0f'],
};

let uid = 0;

/**
 * Rend un Sprite en SVG.
 * @param {object} sprite entrée de SPRITES
 * @param {string} variant identifiant de variante
 * @param {number} size côté en pixels
 */
export function spriteSvg(sprite, variant = 'normal', size = 64) {
  const id = `sg${uid++}`;
  const paint = VARIANT_PAINT[variant] || sprite.palette;
  const [from, to] = paint;
  const path = SHAPES[sprite.shape] || SHAPES.orb;
  const holo = variant === 'holofoil' || variant === 'galaxy';

  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-hidden="true" focusable="false" class="sprite-art sprite-art--${variant}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${from}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${from}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#${id}g)"/>
  <path d="${path}" fill="url(#${id})" stroke="rgba(8,10,18,.55)" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
  ${holo ? `<path d="${path}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>` : ''}
</svg>`;
}

/** Pastille de couleur utilisée par les filtres et la légende des variantes. */
export function variantChipStyle(variantId) {
  const paint = VARIANT_PAINT[variantId];
  const v = VARIANT_INDEX[variantId];
  if (!paint) return `--chip-a:${v.accent};--chip-b:${v.accent}`;
  return `--chip-a:${paint[0]};--chip-b:${paint[1]}`;
}
