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
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = await import(pathToFileURL(path.join(racine, 'assets/js/data.js')).href);
const { SAISONS, setSaison, migrateSlot, unreleasedOf } = D;
const { getStrings } = await import(pathToFileURL(path.join(racine, 'assets/js/i18n.js')).href);
const t = getStrings();

let problemes = 0;
let saisonCourante = '';
const ko = (m) => {
  problemes++;
  console.error(`  PROBLÈME [${saisonCourante}] — ` + m);
};
const ok = (m) => console.log('  ok — ' + m);

function controler() {
  const { SPRITES, ALL_SLOTS, BIT_SLOTS, SLOT_ORDER, TOTAL_SLOTS, RENAMES, VARIANT_RENAMES,
          DATA_DATE } = D;

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

  /*
   * Les cases absentes de SLOT_ORDER sont ajoutées automatiquement en fin de
   * ALL_SLOTS — mais dans l'ordre de SPRITES, donc leurs positions bougent dès
   * qu'une variante est ajoutée à un Sprite plus haut dans la liste. Tant qu'elles
   * ne sont pas figées, un code de partage émis entre-temps se relira de travers.
   */
  const figees = new Set(SLOT_ORDER.map((s) => migrateSlot(s) || s));
  const horsOrdre = courantes.filter((s) => !figees.has(s));
  if (horsOrdre.length) {
    ko(
      `${horsOrdre.length} case(s) absente(s) de SLOT_ORDER : ${horsOrdre.join(', ')}\n` +
        "             leurs positions de bits ne sont pas figées — recopiez le bloc ci-dessous."
    );
  }

  const doublons = ALL_SLOTS.filter((s, i) => ALL_SLOTS.indexOf(s) !== i);
  if (doublons.length) ko('ALL_SLOTS contient des doublons : ' + doublons.join(', '));

  const manquantes = courantes.filter((s) => !vues.includes(s));
  if (manquantes.length) ko('cases absentes de ALL_SLOTS : ' + manquantes.join(', '));
  else ok(`${ALL_SLOTS.length} positions de bits, ${vues.length} encore en jeu`);

  const mortes = BIT_SLOTS.filter((s) => !s).length;
  if (mortes) console.log(`  info — ${mortes} position(s) conservée(s) pour des cases retirées du jeu`);

  /* ------------------------------------------------------- illustrations */

  const dossier = path.join(racine, 'assets/sprites');
  const fichiers = new Set(fs.existsSync(dossier) ? fs.readdirSync(dossier) : []);
  const noArt = new Set(SPRITES.filter((s) => s.noArt).map((s) => s.id));
  const sansImage = courantes.filter(
    (slot) => !noArt.has(slot.split(':')[0]) && !fichiers.has(slot.replace(':', '_') + '.webp')
  );
  if (noArt.size) console.log(`  info — dessin de repli assumé pour : ${[...noArt].join(', ')}`);
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

  if (horsOrdre.length) {
    console.log('\nSLOT_ORDER à jour, à recopier dans assets/js/data.js :\n');
    const lignes = [];
    for (let i = 0; i < ALL_SLOTS.length; i += 4)
      lignes.push('  ' + ALL_SLOTS.slice(i, i + 4).map((s) => `'${s}',`).join(' '));
    console.log(lignes.join('\n'));
  }

}

for (const saison of SAISONS) {
  saisonCourante = saison.id;
  setSaison(saison.id);
  console.log(`\n— ${saison.nom} (${saison.sousTitre}) —`);
  controler();
}

console.log(problemes ? `\n${problemes} problème(s).` : '\nTout est cohérent.');
process.exit(problemes ? 1 : 0);
