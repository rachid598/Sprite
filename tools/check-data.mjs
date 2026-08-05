/*
 * Contrôle des données avant publication.
 *
 *   node tools/check-data.mjs
 *
 * Vérifie ce qui, en cas d'erreur, ferait perdre ou corrompre de la
 * progression : traductions manquantes, illustrations absentes, ordre des bits
 * des codes de partage. Affiche à la fin le bloc SLOT_ORDER à jour si des cases
 * ont été ajoutées.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SPRITES, ALL_SLOTS, BIT_SLOTS, TOTAL_SLOTS, RENAMES, VARIANT_RENAMES, DATA_DATE, unreleasedOf } =
  await import(path.join(racine, 'assets/js/data.js'));
const { getStrings } = await import(path.join(racine, 'assets/js/i18n.js'));
const t = getStrings();

let problemes = 0;
const ko = (m) => {
  problemes++;
  console.error('  PROBLÈME — ' + m);
};
const ok = (m) => console.log('  ok — ' + m);

/* ------------------------------------------------------------ cohérence */

const ids = SPRITES.map((s) => s.id);
if (new Set(ids).size !== ids.length) ko('identifiants de Sprite en double');
else ok(`${SPRITES.length} Sprites, identifiants uniques`);

for (const s of SPRITES) {
  const toutes = [...s.variants, ...unreleasedOf(s)];
  if (new Set(toutes).size !== toutes.length) ko(`${s.id} : variante en double`);
  if (!t.name[s.id]) ko(`${s.id} : nom manquant dans i18n.js (name)`);
  if (s.ability?.verified && !t.ability[s.id]) ko(`${s.id} : effet annoncé vérifié mais absent de i18n.js`);
}

/* Un identifiant renommé ne doit plus exister comme Sprite courant. */
for (const [ancien, neuf] of Object.entries(RENAMES)) {
  if (ids.includes(ancien)) ko(`RENAMES : « ${ancien} » existe encore dans SPRITES`);
  if (!ids.includes(neuf)) ko(`RENAMES : « ${ancien} » pointe vers « ${neuf} », inconnu`);
}
for (const neuf of Object.values(VARIANT_RENAMES)) {
  if (!SPRITES.some((s) => [...s.variants, ...unreleasedOf(s)].includes(neuf)))
    ko(`VARIANT_RENAMES pointe vers « ${neuf} », variante inconnue`);
}
ok(`${Object.keys(RENAMES).length} renommages de Sprite déclarés`);

/* ------------------------------------------------- ordre des bits figé */

const courantes = [
  ...SPRITES.flatMap((s) => s.variants.map((v) => `${s.id}:${v}`)),
  ...SPRITES.flatMap((s) => unreleasedOf(s).map((v) => `${s.id}:${v}`)),
];

const vues = BIT_SLOTS.filter(Boolean);
const oubliees = courantes.filter((s) => !vues.includes(s));
if (oubliees.length) {
  // Sans conséquence : ALL_SLOTS les place déjà en fin. Mais figer l'ordre
  // évite d'en dépendre le jour où SPRITES sera réordonné.
  console.log(`  info — ${oubliees.length} case(s) hors de SLOT_ORDER, ajoutées en fin :`);
  console.log('         ' + oubliees.join(', '));
}

const doublons = ALL_SLOTS.filter((s, i) => ALL_SLOTS.indexOf(s) !== i);
if (doublons.length) ko('ALL_SLOTS contient des doublons : ' + doublons.join(', '));

const manquantes = courantes.filter((s) => !vues.includes(s));
if (manquantes.length && !oubliees.length) ko('cases absentes de ALL_SLOTS : ' + manquantes.join(', '));
else ok(`${ALL_SLOTS.length} positions de bits, ${vues.length} encore en jeu`);

const mortes = BIT_SLOTS.filter((s) => !s).length;
if (mortes) console.log(`  info — ${mortes} position(s) conservée(s) pour des cases retirées du jeu`);

/* ------------------------------------------------------- illustrations */

const dossier = path.join(racine, 'assets/sprites');
const fichiers = new Set(fs.existsSync(dossier) ? fs.readdirSync(dossier) : []);
const sansImage = courantes.filter((slot) => !fichiers.has(slot.replace(':', '_') + '.webp'));
if (sansImage.length) console.log(`  info — ${sansImage.length} case(s) sans illustration (repli SVG) `);
else ok(`${courantes.length} illustrations présentes`);

/* -------------------------------------------------------------- totaux */

const attendu = SPRITES.reduce((n, s) => n + s.variants.length, 0);
if (TOTAL_SLOTS !== attendu) ko(`TOTAL_SLOTS vaut ${TOTAL_SLOTS}, attendu ${attendu}`);
else ok(`${TOTAL_SLOTS} cases publiées · ${ALL_SLOTS.length} au total`);

const aujourdhui = new Date().toISOString().slice(0, 10);
if (DATA_DATE > aujourdhui) ko(`DATA_DATE (${DATA_DATE}) est dans le futur`);
else console.log(`  info — données datées du ${DATA_DATE}`);

/* -------------------------------------- bloc à recopier le cas échéant */

if (oubliees.length) {
  console.log('\nSLOT_ORDER à jour, à recopier dans assets/js/data.js :\n');
  const lignes = [];
  for (let i = 0; i < ALL_SLOTS.length; i += 4)
    lignes.push('  ' + ALL_SLOTS.slice(i, i + 4).map((s) => `'${s}',`).join(' '));
  console.log(lignes.join('\n'));
}

console.log(problemes ? `\n${problemes} problème(s).` : '\nTout est cohérent.');
process.exit(problemes ? 1 : 0);
