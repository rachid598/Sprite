/*
 * Adaptateur de SpriteCollectionResponseDto (api-fortnite.com, OpenAPI).
 * Aucun accès réseau ni stockage : l'import est une union, jamais un effacement.
 */
import { SAISONS } from './data.js';
import { getStrings } from './i18n.js';

const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES = {
  eightbit: ['8-bit'], stormscout: ['storm scout'], reaper: ['grim', 'grim reaper'],
  zeropoint: ['zero point'], peanut: ['burnt peanut', 'the burnt peanut'],
  llama: ["lootin llama"], peely: ['peeky peely'], deer: ['the deer'],
  crash: ['crash bandicoot'], fishy: ['fishstick'], honey: ['honey'],
  onewishwillow: ['one wish willow'], dumpsterdive: ['dumpster dive'],
  spookydash: ['spooky dash'], megaman: ['mega man'], vinijr: ['vini jr'],
};
const VARIANTS = {
  base: 'normal', basic: 'normal', normal: 'normal', gold: 'gold', or: 'gold',
  gummy: 'gummy', gelifie: 'gummy', galaxy: 'galaxy', galaxie: 'galaxy',
  gem: 'gem', gemme: 'gem', holofoil: 'holofoil', iridescent: 'holofoil',
  cube: 'cube', quack: 'quack', canardesque: 'quack',
  cheat: 'cheatmaster', cheatmaster: 'cheatmaster',
  loothacker: 'loothacker', piratedesbutins: 'loothacker',
  bountyhunter: 'bountyhunter', chasseurdetete: 'bountyhunter',
  trickortreat: 'trickortreat', farceoufriandise: 'trickortreat',
};

export function parseEpicCollection(payload, seasonId) {
  const season = SAISONS.find((s) => s.id === seasonId);
  if (!season) throw new Error('Saison inconnue.');
  if (!payload || !Array.isArray(payload.sprites) || typeof payload.gameVersion !== 'string') {
    throw new Error('Format de collection Fortnite non reconnu.');
  }
  // Ne jamais deviner une saison à partir du nom des Sprites.
  const major = Number(payload.gameVersion.match(/^(\d+)\./)?.[1]);
  if (major !== (seasonId === 's3' ? 41 : 42)) {
    throw new Error('Cette collection appartient à une autre saison.');
  }
  const names = new Map();
  const text = getStrings();
  for (const sprite of season.sprites) {
    for (const name of [sprite.id, text.name[sprite.id], ...(ALIASES[sprite.id] || [])]) {
      names.set(normalize(name), sprite);
      names.set(normalize(name + ' Sprite'), sprite);
    }
  }
  const owned = new Set(), mastered = new Set(), unknown = [];
  for (const family of payload.sprites) {
    if (!family || !Array.isArray(family.variants)) throw new Error('Famille de Sprites invalide.');
    const sprite = names.get(normalize(family.name)) || names.get(normalize(family.id));
    for (const variant of family.variants) {
      if (!variant || typeof variant.owned !== 'boolean' ||
          (variant.mastered != null && typeof variant.mastered !== 'boolean')) {
        throw new Error('État de possession ou de maîtrise invalide.');
      }
      if (!variant.owned) continue;
      const id = VARIANTS[normalize(variant.variant)];
      if (!sprite || !id || !sprite.variants.includes(id)) {
        unknown.push(String(family.name || family.id || '?') + ' / ' + String(variant.variant || '?'));
        continue;
      }
      const slot = sprite.id + ':' + id;
      owned.add(slot);
      if (variant.mastered === true) mastered.add(slot);
    }
  }
  return { seasonId, owned, mastered, unknown };
}

export function mergeEpicCollection(current, incoming) {
  const owned = new Set([...current.owned, ...incoming.owned]);
  const mastered = new Set([...current.mastered, ...incoming.mastered].filter((s) => owned.has(s)));
  return { owned, mastered };
}
