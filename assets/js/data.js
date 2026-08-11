/*
 * Base de données des Sprites — 25 Sprites, 117 cases publiées (Sprite × variante).
 *
 * `id` sert de clé de stockage : ne jamais le renommer une fois publié.
 * `variants` liste les variantes disponibles en jeu pour ce Sprite.
 * `unreleased` liste les variantes déjà présentes dans les fichiers du jeu mais
 *   pas encore sorties : masquées par défaut et exclues du total publié.
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
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'quack', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'earth',
    rarity: 'rare',
    dropRate: 8.73,
    shape: 'leaf',
    palette: ['#7bd66a', '#1d7a3c'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube', 'quack', 'gem'],
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
    dropRate: 13.79,
    shape: 'fish',
    palette: ['#5fe0d0', '#1a7f9c'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'air',
    rarity: 'rare',
    dropRate: 8.7,
    dropUnverified: true, // aucun taux publié
    shape: 'swirl',
    palette: ['#d8ecff', '#7aa8d8'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'duck',
    rarity: 'epic',
    dropRate: 6.48,
    shape: 'duck',
    palette: ['#ffd94d', '#e08a12'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'ghost',
    rarity: 'epic',
    dropRate: 5.25,
    shape: 'ghost',
    palette: ['#e8f0ff', '#8f9dc4'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'demon',
    rarity: 'epic',
    dropRate: 6.48,
    shape: 'demon',
    palette: ['#ff5a6e', '#8c0f2e'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'king',
    rarity: 'epic',
    dropRate: 5.25,
    shape: 'crown',
    palette: ['#ffe07a', '#c48a11'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'aura',
    rarity: 'epic',
    dropRate: 6.48,
    shape: 'orb',
    palette: ['#b58cff', '#5a2fb8'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'striker',
    rarity: 'epic',
    dropRate: 5.25,
    shape: 'ball',
    palette: ['#ffffff', '#3c4657'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'dream',
    rarity: 'legendary',
    dropRate: 4.45,
    shape: 'moon',
    palette: ['#a6c8ff', '#4b3fb0'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'punk',
    rarity: 'legendary',
    dropRate: 4.45,
    shape: 'bolt',
    palette: ['#ff5fa8', '#7a1050'],
    // Pas de Gemme : apparue le 30 juillet 2026 puis retirée, et absente de la
    // vague du 6 août. Sa position reste réservée dans SLOT_ORDER pour ne pas
    // décaler les bits suivants ; `migrateSlot` la renvoie à null, donc elle ne
    // s'affiche plus et ne compte plus nulle part.
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'boss',
    rarity: 'legendary',
    dropRate: 4.45,
    shape: 'shield',
    palette: ['#ff8a3d', '#8c2f0a'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'seven',
    rarity: 'legendary',
    dropRate: 3.63,
    shape: 'seven',
    palette: ['#7ad9ff', '#123a66'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'llama',
    rarity: 'legendary',
    dropRate: 4.45,
    shape: 'llama',
    palette: ['#7ad0ff', '#c05cff'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'peely',
    rarity: 'legendary',
    dropRate: 4.62,
    shape: 'banana',
    palette: ['#ffe14d', '#c78a08'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil'],
    ability: { verified: true },
  },
  {
    id: 'reaper',
    rarity: 'mythic',
    dropRate: 0.15,
    shape: 'scythe',
    palette: ['#9d8cff', '#1c1030'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'zeropoint',
    rarity: 'mythic',
    dropRate: 0.00034,
    shape: 'zero',
    palette: ['#ffd86b', '#ff6a2e'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube', 'quack', 'gem'],
    ability: { verified: true },
  },
  {
    id: 'batman',
    rarity: 'mythic',
    dropRate: 1.44,
    shape: 'bat',
    palette: ['#8fa4c8', '#141a26'],
    variants: ['normal', 'gold', 'gummy', 'galaxy', 'holofoil', 'cube'],
    ability: { verified: true },
  },
  {
    id: 'peanut',
    rarity: 'mythic',
    dropRate: 2.14,
    shape: 'peanut',
    palette: ['#d99a5c', '#5c3316'],
    variants: ['normal'],
    ability: { verified: true },
  },
  {
    id: 'vinijr',
    rarity: 'mythic',
    dropRate: 2.14,
    shape: 'ball',
    palette: ['#ffe98a', '#1f6f3f'],
    variants: ['normal'],
    ability: { verified: true },
  },
  {
    id: 'pollo',
    rarity: 'mythic',
    dropRate: 2.14,
    shape: 'chicken',
    palette: ['#fff0c2', '#e0562a'],
    variants: ['normal'],
    ability: { verified: true },
  },
  {
    id: 'johnwick',
    rarity: 'mythic',
    dropRate: 2.8,
    dropUnverified: true, // aucun taux publié
    shape: 'suit',
    palette: ['#6f7b93', '#0e1220'],
    variants: ['normal'],
    ability: { verified: true },
  },
  // Sortie le 4 août 2026, après avoir été activée par erreur le 30 juillet
  // puis retirée le jour même. Une seule finition, comme les autres Mythiques
  // de collaboration (Pollo, Vini Jr., John Wick).
  {
    id: 'ironmouse',
    rarity: 'mythic',
    dropRate: 2.14,
    shape: 'demon',
    palette: ['#ff8ad4', '#5b1f6e'],
    variants: ['normal'],
    ability: { verified: true },
  },
];

/**
 * Date de dernière vérification des données, affichée dans la page.
 * À changer en même temps que le contenu de SPRITES.
 */
export const DATA_DATE = '2026-08-06';

/**
 * Date du relevé des taux d'apparition, distincte de DATA_DATE.
 *
 * Les taux changent à chaque patch, quand de nouveaux Sprites entrent dans le
 * butin. Trois relevés publics consultés donnaient trois jeux de chiffres
 * différents pour les mêmes Sprites : celui retenu est le plus récent et le
 * seul rattaché explicitement à une version du jeu. Un Sprite sans taux publié
 * porte `dropUnverified` et affiche « non confirmé » plutôt qu'un chiffre
 * inventé.
 */
export const DROP_DATE = '2026-08-07';

/**
 * Anciens identifiants → nouveaux.
 *
 * Renommer un `id` sans cela ferait disparaître les cases correspondantes de la
 * collection : elles sont stockées sous la forme `<id>:<variante>`. Toute
 * entrée ajoutée ici est migrée automatiquement au chargement, et peut y rester
 * indéfiniment — le coût est nul.
 */
export const RENAMES = {
  // ancien: 'nouveau'
  knight: 'batman',
  striker11: 'vinijr',
  agent: 'johnwick',
  soccer: 'striker',
  drifter: 'aura',
  grimreaper: 'reaper',
  fossilmeal: 'batman',
  theburntpeanut: 'peanut',
  cokeparmesan: 'vinijr',
  companystargazer: 'pollo',
  fillergrunt: 'johnwick',
};

/** Variantes renommées, même principe. */
export const VARIANT_RENAMES = {
  basic: 'normal',
  candy: 'gummy',
  holo: 'holofoil',
};

/**
 * Ramène une case au vocabulaire courant.
 * @param {string} slot au format `<sprite>:<variante>`
 * @returns {string|null} null si le Sprite ou la variante n'existe plus
 */
export function migrateSlot(slot) {
  const [sprite, variante] = String(slot).split(':');
  if (!sprite || !variante) return null;

  const s = RENAMES[sprite] || sprite;
  const v = VARIANT_RENAMES[variante] || variante;

  const entree = SPRITES.find((x) => x.id === s);
  if (!entree) return null;
  if (!entree.variants.includes(v) && !(entree.unreleased || []).includes(v)) return null;
  return `${s}:${v}`;
}

export const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, order: i }]));
export const VARIANT_INDEX = Object.fromEntries(VARIANTS.map((v, i) => [v.id, { ...v, order: i }]));
export const SPRITE_INDEX = Object.fromEntries(SPRITES.map((s) => [s.id, s]));

/** Variantes non publiées d'un Sprite (tableau vide par défaut). */
export const unreleasedOf = (sprite) => sprite.unreleased || [];

/** Nombre de cases comptant dans la progression, hors variantes non publiées. */
export const TOTAL_SLOTS = SPRITES.reduce((n, s) => n + s.variants.length, 0);

/**
 * Ordre historique des bits des codes de partage. **Figé.**
 *
 * Déduire cet ordre de SPRITES serait une erreur : ajouter une variante à un
 * Sprite du milieu de la liste décalerait tous les bits suivants, et un ancien
 * lien de partage se décoderait alors sur les mauvais Sprites — une corruption
 * silencieuse, pire qu'une perte visible.
 *
 * Règles : ne jamais réordonner, ne jamais retirer une ligne. Une case retirée
 * du jeu garde sa place — elle est simplement ignorée au décodage. Les cases
 * absentes d'ici sont ajoutées en fin de `ALL_SLOTS`, ce qui rend l'oubli sans
 * conséquence ; `node tools/check-data.mjs` le signale et affiche la liste à
 * jour à recopier.
 */
export const SLOT_ORDER = [
  'water:normal', 'water:gold', 'water:gummy', 'water:galaxy',
  'water:holofoil', 'water:quack', 'earth:normal', 'earth:gold',
  'earth:gummy', 'earth:galaxy', 'earth:cube', 'earth:quack',
  'fire:normal', 'fire:gold', 'fire:gummy', 'fire:galaxy',
  'fire:holofoil', 'fire:cube', 'fire:quack', 'fishy:normal',
  'fishy:gold', 'fishy:gummy', 'fishy:galaxy', 'fishy:cube',
  'air:normal', 'air:gold', 'air:gummy', 'air:galaxy',
  'air:holofoil', 'duck:normal', 'duck:gold', 'duck:gummy',
  'duck:galaxy', 'ghost:normal', 'ghost:gold', 'ghost:gummy',
  'ghost:galaxy', 'ghost:holofoil', 'demon:normal', 'demon:gold',
  'demon:gummy', 'demon:galaxy', 'king:normal', 'king:gold',
  'king:gummy', 'king:galaxy', 'king:holofoil', 'aura:normal',
  'aura:gold', 'aura:gummy', 'aura:galaxy', 'striker:normal',
  'striker:gold', 'striker:gummy', 'striker:galaxy', 'striker:holofoil',
  'dream:normal', 'dream:gold', 'dream:gummy', 'dream:galaxy',
  'dream:cube', 'punk:normal', 'punk:gold', 'punk:gummy',
  'punk:galaxy', 'punk:cube', 'boss:normal', 'boss:gold',
  'boss:gummy', 'boss:galaxy', 'boss:cube', 'seven:normal',
  'seven:gold', 'seven:gummy', 'seven:galaxy', 'seven:holofoil',
  'llama:normal', 'llama:gold', 'llama:gummy', 'llama:galaxy',
  'llama:gem', 'peely:normal', 'peely:gold', 'peely:gummy',
  'peely:galaxy', 'peely:holofoil', 'reaper:normal', 'reaper:gold',
  'reaper:gummy', 'reaper:galaxy', 'reaper:holofoil', 'reaper:cube',
  'zeropoint:normal', 'zeropoint:gold', 'zeropoint:gummy', 'zeropoint:galaxy',
  'zeropoint:holofoil', 'zeropoint:cube', 'zeropoint:quack', 'batman:normal',
  'batman:gold', 'batman:gummy', 'batman:galaxy', 'batman:holofoil',
  'batman:cube', 'peanut:normal', 'vinijr:normal', 'pollo:normal',
  'johnwick:normal', 'water:gem', 'earth:gem', 'duck:gem',
  'demon:gem', 'aura:gem', 'punk:gem', 'reaper:gem',
  'zeropoint:gem', 'ironmouse:normal',
];

/**
 * Ordre des bits effectivement utilisé : l'historique, puis les cases apparues
 * depuis. Les nouveautés se retrouvent donc toujours à la fin.
 */
export const ALL_SLOTS = [
  ...SLOT_ORDER,
  ...[
    ...SPRITES.flatMap((s) => s.variants.map((v) => `${s.id}:${v}`)),
    ...SPRITES.flatMap((s) => unreleasedOf(s).map((v) => `${s.id}:${v}`)),
  ].filter((slot) => !SLOT_ORDER.includes(slot) && !SLOT_ORDER.some((o) => migrateSlot(o) === slot)),
];

/**
 * Case courante correspondant à chaque bit : `null` si elle a disparu du jeu.
 * Passer par `migrateSlot` fait suivre les renommages sans toucher à l'ordre.
 */
export const BIT_SLOTS = ALL_SLOTS.map(migrateSlot);
