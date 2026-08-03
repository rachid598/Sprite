/*
 * Base de données des Sprites — 24 Sprites, 109 cases (Sprite × variante).
 *
 * `id` sert de clé de stockage : ne jamais le renommer une fois publié.
 * `variants` liste les identifiants de variantes disponibles pour ce Sprite.
 * `ability.verified` = true quand l'effet est documenté publiquement.
 */

export const VARIANTS = [
  { id: 'normal', accent: '#8ab4ff' },
  { id: 'gold', accent: '#f5c542' },
  { id: 'gummy', accent: '#ff7ab8' },
  { id: 'galaxy', accent: '#a97bff' },
  { id: 'gem', accent: '#3fd6c4' },
  { id: 'holofoil', accent: '#e4a6ff' },
  { id: 'cube', accent: '#c05cff' },
  { id: 'quack', accent: '#ffb24d' },
];

export const RARITIES = [
  { id: 'rare', color: '#3aa0ff' },
  { id: 'epic', color: '#b45cff' },
  { id: 'legendary', color: '#ff9f2e' },
  { id: 'mythic', color: '#ffd23f' },
];

/** Ordre d'affichage par défaut : rareté croissante. */
export const SPRITES = [
  {
    id: 'water',
    rarity: 'rare',
    dropRate: 8.73,
    shape: 'drop',
    palette: ['#2ec5ff', '#0a6cd8'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'quack'],
    ability: { verified: true },
  },
  {
    id: 'earth',
    rarity: 'rare',
    dropRate: 8.73,
    shape: 'leaf',
    palette: ['#7bd66a', '#1d7a3c'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube', 'quack'],
    ability: { verified: true },
  },
  {
    id: 'fire',
    rarity: 'rare',
    dropRate: 8.73,
    shape: 'flame',
    palette: ['#ffb03a', '#e33a1f'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube', 'quack'],
    ability: { verified: true },
  },
  {
    id: 'fishy',
    rarity: 'rare',
    dropRate: 8.7,
    shape: 'fish',
    palette: ['#5fe0d0', '#1a7f9c'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'air',
    rarity: 'rare',
    dropRate: 8.7,
    shape: 'swirl',
    palette: ['#d8ecff', '#7aa8d8'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'duck',
    rarity: 'epic',
    dropRate: 7.5,
    shape: 'duck',
    palette: ['#ffd94d', '#e08a12'],
    variants: ['normal', 'gold', 'gummy', 'galaxy'],
    ability: { verified: true },
  },
  {
    id: 'ghost',
    rarity: 'epic',
    dropRate: 7.5,
    shape: 'ghost',
    palette: ['#e8f0ff', '#8f9dc4'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'demon',
    rarity: 'epic',
    dropRate: 7.54,
    shape: 'demon',
    palette: ['#ff5a6e', '#8c0f2e'],
    variants: ['normal', 'gold', 'gummy', 'galaxy'],
    ability: { verified: true },
  },
  {
    id: 'king',
    rarity: 'epic',
    dropRate: 7.5,
    shape: 'crown',
    palette: ['#ffe07a', '#c48a11'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'aura',
    rarity: 'epic',
    dropRate: 7.4,
    shape: 'orb',
    palette: ['#b58cff', '#5a2fb8'],
    variants: ['normal', 'gold', 'gummy', 'galaxy'],
    ability: { verified: true },
  },
  {
    id: 'striker',
    rarity: 'epic',
    dropRate: 7.4,
    shape: 'ball',
    palette: ['#ffffff', '#3c4657'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'dream',
    rarity: 'legendary',
    dropRate: 4.09,
    shape: 'moon',
    palette: ['#a6c8ff', '#4b3fb0'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'punk',
    rarity: 'legendary',
    dropRate: 4.11,
    shape: 'bolt',
    palette: ['#ff5fa8', '#7a1050'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'boss',
    rarity: 'legendary',
    dropRate: 4.0,
    shape: 'shield',
    palette: ['#ff8a3d', '#8c2f0a'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'seven',
    rarity: 'legendary',
    dropRate: 4.0,
    shape: 'seven',
    palette: ['#7ad9ff', '#123a66'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'llama',
    rarity: 'legendary',
    dropRate: 3.9,
    shape: 'llama',
    palette: ['#7ad0ff', '#c05cff'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'peely',
    rarity: 'legendary',
    dropRate: 3.9,
    shape: 'banana',
    palette: ['#ffe14d', '#c78a08'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'reaper',
    rarity: 'mythic',
    dropRate: 2.9,
    shape: 'scythe',
    palette: ['#9d8cff', '#1c1030'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'zeropoint',
    rarity: 'mythic',
    dropRate: 0.00034,
    shape: 'zero',
    palette: ['#ffd86b', '#ff6a2e'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube', 'quack'],
    ability: { verified: true },
  },
  {
    id: 'batman',
    rarity: 'mythic',
    dropRate: 2.9,
    shape: 'bat',
    palette: ['#8fa4c8', '#141a26'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'peanut',
    rarity: 'mythic',
    dropRate: 2.97,
    shape: 'peanut',
    palette: ['#d99a5c', '#5c3316'],
    variants: ['normal'],
    ability: { verified: true },
  },
  {
    id: 'vinijr',
    rarity: 'mythic',
    dropRate: 2.8,
    shape: 'ball',
    palette: ['#ffe98a', '#1f6f3f'],
    variants: ['normal'],
    ability: { verified: true },
  },
  {
    id: 'pollo',
    rarity: 'mythic',
    dropRate: 2.8,
    shape: 'chicken',
    palette: ['#fff0c2', '#e0562a'],
    variants: ['normal'],
    ability: { verified: true },
  },
  {
    id: 'johnwick',
    rarity: 'mythic',
    dropRate: 2.8,
    shape: 'suit',
    palette: ['#6f7b93', '#0e1220'],
    variants: ['normal'],
    ability: { verified: true },
  },
];

export const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, order: i }]));
export const VARIANT_INDEX = Object.fromEntries(VARIANTS.map((v, i) => [v.id, { ...v, order: i }]));
export const SPRITE_INDEX = Object.fromEntries(SPRITES.map((s) => [s.id, s]));

/** Nombre total de cases à cocher (Sprite × variante) : 109. */
export const TOTAL_SLOTS = SPRITES.reduce((n, s) => n + s.variants.length, 0);

/** Liste ordonnée et stable de toutes les cases — ordre des bits des codes de partage. */
export const ALL_SLOTS = SPRITES.flatMap((s) => s.variants.map((v) => `${s.id}:${v}`));
