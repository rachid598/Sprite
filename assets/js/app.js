import {
  SPRITES,
  VARIANTS,
  RARITIES,
  RARITY_INDEX,
  VARIANT_INDEX,
  TOTAL_SLOTS,
  SPRITE_INDEX,
  DATA_DATE,
  DROP_DATE,
  SAISONS,
  SAISON,
  SAISON_DEFAUT,
  setSaison,
  unreleasedOf,
} from './data.js';
import { getStrings } from './i18n.js';
import { spriteImg, spriteSvg, variantChipStyle } from './art.js';
import * as store from './store.js';
import { registerServiceWorker, applyUpdate, trackInstall, estInstallee, estIos } from './pwa.js';
// Fichier nommé « salon » et non « sync » : certains bloqueurs de publicité
// filtrent les scripts contenant « sync », terme courant du pistage.
import * as sync from './salon.js';

const lang = 'fr'; // sert au formatage des nombres et au tri alphabétique
const t = getStrings();
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  owned: new Set(),
  mastered: new Set(), // sous-ensemble de `owned` : les cases montees au niveau max
  status: 'all', // all | owned | missing
  rarities: new Set(),
  variants: new Set(),
  query: '',
  sort: 'rarity',
  showUnreleased: false,
  // Verrou d'édition : protège la collection des clics involontaires pendant
  // qu'on parcourt la grille. N'affecte que la saisie, jamais l'affichage.
  locked: false,
  updatedAt: 0, // date du dernier changement local, sert d'arbitre a la synchro
};

/* ---------------------------------------------------------------- helpers */

const slotId = (spriteId, variantId) => `${spriteId}:${variantId}`;
const nameOf = (sprite) => t.name[sprite.id] || sprite.id;
const ownedCount = (sprite) => sprite.variants.filter((v) => state.owned.has(slotId(sprite.id, v))).length;
const isComplete = (sprite) => ownedCount(sprite) === sprite.variants.length;

/** Variantes à afficher : les publiées, plus les non publiées si l'option est active. */
const shownVariants = (sprite) =>
  state.showUnreleased ? [...sprite.variants, ...unreleasedOf(sprite)] : sprite.variants;

/** Les variantes non publiées sont cochables mais ne comptent pas dans le total. */
const isUnreleased = (sprite, variant) => unreleasedOf(sprite).includes(variant);

/** Cases possédées comptant dans la progression — hors variantes non publiées. */
const ownedSlots = () => SPRITES.reduce((n, s) => n + ownedCount(s), 0);

/** Cases maîtrisées d'un Sprite donné. */
const masteredCount = (sprite) =>
  sprite.variants.filter((v) => state.mastered.has(slotId(sprite.id, v))).length;

/**
 * Niveau d'une case : 0 rien, 1 possédé, 2 maîtrisé.
 * Un clic fait avancer d'un cran et revient à 0 après le dernier.
 */
const NIVEAUX = 3;
const levelOf = (slot) => (state.mastered.has(slot) ? 2 : state.owned.has(slot) ? 1 : 0);

function setLevel(slot, niveau) {
  state.owned.delete(slot);
  state.mastered.delete(slot);
  if (niveau >= 1) state.owned.add(slot);
  if (niveau >= 2) state.mastered.add(slot);
}

const cycleLevel = (slot) => setLevel(slot, (levelOf(slot) + 1) % NIVEAUX);

/** Nombre de cases maîtrisées comptant dans la progression. */
const masteredSlots = () => SPRITES.reduce((n, sp) => n + masteredCount(sp), 0);

/** Vrai quand toutes les variantes affichées d'un Sprite portent la couronne. */
const allMastered = (sprite) =>
  shownVariants(sprite).every((v) => state.mastered.has(slotId(sprite.id, v)));

function abilityText(sprite) {
  return sprite.ability.verified ? t.ability[sprite.id] : t.card.abilityUnknown;
}

function formatDrop(rate) {
  const digits = rate < 0.01 ? 5 : rate < 1 ? 2 : 1;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(rate) + ' %';
}

/**
 * Taux affiché sur une carte.
 * Sans chiffre publié, on l'annonce comme non confirmé au lieu d'afficher une
 * valeur inventée — même règle que pour les effets passifs.
 */
function dropText(sprite) {
  return sprite.dropUnverified ? t.card.dropUnknown : formatDrop(sprite.dropRate);
}

function fill(str, map) {
  return Object.entries(map).reduce((s, [k, v]) => s.split(k).join(v), str);
}

/** Petite couronne affichée sur les cases maîtrisées. */
const COURONNE =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
  '<path d="M2 18 L4 6 L9 12 L12 4 L15 12 L20 6 L22 18 Z" fill="currentColor"/>' +
  '<rect x="2" y="18.5" width="20" height="3" rx="1.5" fill="currentColor"/></svg>';

/* ------------------------------------------------------------- rendering */

/* ------------------------------------------------------ saisons */

function renderSaisons() {
  surElement('#season-switch', (el) => {
    el.innerHTML = SAISONS.map(
      (s) => `<button type="button" class="season" data-saison="${s.id}"
        aria-pressed="${s.id === SAISON.id}"
        title="${s.nom} — ${s.encours ? t.season.current : t.season.past}">
        <b>${s.nom}</b><span>${s.sousTitre}</span>
      </button>`
    ).join('');
  });

  // Une saison passée ne se collectionne plus en jeu : autant le dire.
  surElement('#season-note', (el) => {
    el.hidden = !!SAISON.encours;
    el.textContent = SAISON.encours ? '' : t.season.pastNote;
  });
}

/**
 * Bascule de saison : chaque saison a sa propre collection, ses propres
 * variantes et sa propre branche de synchronisation. On recharge donc tout,
 * sans jamais toucher au stockage de l'autre saison.
 */
function changerSaison(id) {
  if (id === SAISON.id) return;

  setSaison(id);
  store.savePref('saison', id);

  const saved = store.load();
  state.owned = saved.owned;
  state.mastered = saved.mastered;
  state.updatedAt = saved.updatedAt;
  if (saved.migrated) store.save(state.owned, state.mastered, state.updatedAt);

  // Les variantes diffèrent d'une saison à l'autre : un filtre gardé pointerait
  // sur une variante inexistante et masquerait tout.
  state.variants.clear();

  renderSaisons();
  renderFilters();
  applyStrings();
  renderAll();

  // La synchro vise une autre branche : on repart de zéro pour cette saison.
  syncState.profiles = {};
  syncState.reconcilie = false;
  renderSyncProfiles();
  if (syncState.config) synchroniser({ silencieux: true });
  if (document.body.classList.contains('is-comparing')) renderCompare();

  toast(fill(t.season.switched, { '%d': SAISON.nom.replace(/\D+/g, '') }), { tone: 'ok' });
}

function renderFilters() {
  $('#rarity-filters').innerHTML = RARITIES.map(
    (r) => `<button type="button" class="chip chip--rarity" data-rarity="${r.id}"
      style="--chip-a:${r.color};--chip-b:${r.color}" aria-pressed="false">${t.rarity[r.id]}</button>`
  ).join('');

  $('#variant-filters').innerHTML = VARIANTS.map(
    (v) => `<button type="button" class="chip" data-variant="${v.id}"
      style="${variantChipStyle(v.id)}" aria-pressed="false"
      ${t.variantBonus[v.id] ? `title="${t.variantBonus[v.id]}"` : ''}>${t.variant[v.id]}</button>`
  ).join('');
}

function matchesFilters(sprite) {
  if (state.rarities.size && !state.rarities.has(sprite.rarity)) return false;

  if (state.query) {
    const haystack = `${nameOf(sprite)} ${sprite.id} ${t.rarity[sprite.rarity]}`.toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }

  // Une variante filtrée doit exister sur le Sprite…
  const shown = shownVariants(sprite);
  const variants = state.variants.size ? shown.filter((v) => state.variants.has(v)) : shown;
  if (!variants.length) return false;

  // …et respecter le statut demandé sur au moins une de ces variantes.
  if (state.status === 'owned') return variants.some((v) => state.owned.has(slotId(sprite.id, v)));
  if (state.status === 'missing') return variants.some((v) => !state.owned.has(slotId(sprite.id, v)));
  if (state.status === 'mastered') return variants.some((v) => state.mastered.has(slotId(sprite.id, v)));
  return true;
}

function sortSprites(list) {
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), lang);
  const sorters = {
    rarity: (a, b) => RARITY_INDEX[a.rarity].order - RARITY_INDEX[b.rarity].order || byName(a, b),
    name: byName,
    progress: (a, b) =>
      ownedCount(b) / b.variants.length - ownedCount(a) / a.variants.length || byName(a, b),
    mastery: (a, b) => masteredCount(b) - masteredCount(a) || byName(a, b),
    drop: (a, b) => a.dropRate - b.dropRate || byName(a, b),
  };
  return [...list].sort(sorters[state.sort] || sorters.rarity);
}

/**
 * Rappel des effets propres aux variantes que ce Sprite possède.
 * Le bonus s'ajoute à l'effet du Sprite : sans cette ligne, rien ne l'indique.
 */
function bonusVariantes(sprite) {
  const lignes = shownVariants(sprite)
    .filter((v) => t.variantBonus[v])
    .map((v) => `<li><b>${t.variant[v]}</b> : ${t.variantBonus[v]}</li>`);
  return lignes.length ? `<ul class="card__bonus">${lignes.join('')}</ul>` : '';
}

function cardHtml(sprite) {
  const owned = ownedCount(sprite);
  const total = sprite.variants.length;
  const complete = owned === total;
  const rarity = RARITY_INDEX[sprite.rarity];

  const variants = shownVariants(sprite)
    .map((v) => {
      const id = slotId(sprite.id, v);
      const niveau = levelOf(id);
      const dim = state.variants.size && !state.variants.has(v) ? ' is-dimmed' : '';
      const soon = isUnreleased(sprite, v) ? ' is-unreleased' : '';
      const etat = [t.card.levelNone, t.card.levelOwned, t.card.levelMastered][niveau];
      const bonus = t.variantBonus[v];
      const infobulle = [soon ? t.card.unreleasedHint : '', bonus, etat]
        .filter(Boolean)
        .join(' — ');
      return `<button type="button" class="variant${dim}${soon}" data-slot="${id}"
        data-level="${niveau}" style="${variantChipStyle(v)}"
        title="${infobulle}" aria-label="${nameOf(sprite)} ${t.variant[v]} — ${etat}">
        <span class="variant__art">${spriteImg(sprite, v, 40, '')}</span>
        <span class="variant__name">${t.variant[v]}</span>
        ${niveau === 2 ? `<span class="variant__crown" aria-hidden="true">${COURONNE}</span>` : ''}
        ${soon ? `<span class="variant__soon">${t.card.unreleasedTag}</span>` : ''}
      </button>`;
    })
    .join('');

  return `<article class="card${complete ? ' is-complete' : ''}" data-sprite="${sprite.id}"
      style="--rarity:${rarity.color}">
    <header class="card__head">
      <span class="card__art">${spriteImg(sprite, 'normal', 56, nameOf(sprite))}</span>
      <span class="card__id">
        <h3 class="card__name">${nameOf(sprite)}</h3>
        <span class="badge">${t.rarity[sprite.rarity]}</span>
      </span>
      ${complete ? `<span class="card__done" title="${t.card.complete}">✓</span>` : ''}
    </header>
    <p class="card__ability${sprite.ability.verified ? '' : ' is-muted'}">
      <b>${t.card.ability} :</b> ${abilityText(sprite)}
    </p>
    <p class="card__drop${sprite.dropUnverified ? ' is-muted' : ''}"><b>${t.card.dropRate} :</b> ${dropText(sprite)}</p>
    <div class="card__meter">
      <div class="meter"><i style="width:${(owned / total) * 100}%"></i></div>
      <span class="card__count">${fill(t.card.variantsOwned, { '%o': owned, '%t': total })}</span>
    </div>
    <div class="variants">${variants}</div>
    ${bonusVariantes(sprite)}
    <div class="card__actions">
      <button type="button" class="card__toggle" data-toggle="${sprite.id}">
        ${complete ? t.card.uncheckAll : t.card.checkAll}
      </button>
      <button type="button" class="card__toggle" data-master="${sprite.id}">
        ${allMastered(sprite) ? t.card.unmasterAll : t.card.masterAll}
      </button>
    </div>
  </article>`;
}

function renderGrid() {
  const visible = sortSprites(SPRITES.filter(matchesFilters));
  const grid = $('#grid');

  grid.innerHTML = visible.length
    ? visible.map(cardHtml).join('')
    : `<p class="empty">${t.filters.empty}</p>`;

  const label = visible.length === 1 ? t.filters.countOne : t.filters.countMany;
  $('#result-count').textContent = fill(label, { '%d': visible.length });

  majBadgeFiltres();
}

/**
 * Compte les filtres masqués par le panneau replié.
 * Sans ce repère, un filtre actif hors de vue donnerait l'impression que des
 * Sprites ont disparu.
 */
function majBadgeFiltres() {
  const actifs = state.rarities.size + state.variants.size;
  surElement('#filters-active', (el) => {
    el.hidden = actifs === 0;
    el.textContent = fill(actifs === 1 ? t.filters.activeOne : t.filters.activeMany, {
      '%d': actifs,
    });
  });
}

function renderProgress() {
  const slots = ownedSlots();
  const pct = TOTAL_SLOTS ? (slots / TOTAL_SLOTS) * 100 : 0;
  const unlocked = SPRITES.filter((s) => ownedCount(s) > 0).length;
  const completed = SPRITES.filter(isComplete).length;

  $('#progress-pct').textContent = `${pct.toFixed(1).replace('.', ',')} %`;
  $('#progress-slots').textContent = `${slots} / ${TOTAL_SLOTS}`;
  $('#progress-mastered').textContent = `${masteredSlots()} / ${TOTAL_SLOTS}`;
  $('#progress-sprites').textContent = `${unlocked} / ${SPRITES.length}`;
  $('#progress-complete').textContent = `${completed} / ${SPRITES.length}`;
  $('#progress-ring').style.setProperty('--pct', pct.toFixed(2));
  $('#progress-ring').setAttribute('aria-valuenow', pct.toFixed(1));

  renderRarityProgress();
}

/** Détail « Mythique 4 / 23 », une ligne par rareté, sous les compteurs. */
function renderRarityProgress() {
  const liste = $('#progress-rarity');
  if (!liste) return;

  liste.innerHTML = RARITIES.map((r) => {
    const sprites = SPRITES.filter((s) => s.rarity === r.id);
    const total = sprites.reduce((n, s) => n + s.variants.length, 0);
    const got = sprites.reduce((n, s) => n + ownedCount(s), 0);
    const part = total ? (got / total) * 100 : 0;
    return `<li class="rarity-row" style="--rarity:${r.color}">
      <span class="rarity-row__name">${t.rarity[r.id]}</span>
      <span class="meter meter--thin"><i style="width:${part}%"></i></span>
      <span class="rarity-row__count">${got} / ${total}</span>
    </li>`;
  }).join('');
}

/*
 * Les deux listes d'échange totalisent plus de deux cents lignes et vivent dans
 * un onglet qu'on ne regarde presque jamais en cochant. On les marque périmées
 * et on ne les reconstruit qu'à l'ouverture de l'onglet Comparer.
 */
let tradeAJour = false;

function invaliderTrade() {
  tradeAJour = false;
  if (document.body.classList.contains('is-comparing')) renderTrade();
}

function renderTrade() {
  tradeAJour = true;
  const missing = [];
  const have = [];
  for (const sprite of SPRITES) {
    for (const v of shownVariants(sprite)) {
      const entry = `${nameOf(sprite)} · ${t.variant[v]}`;
      (state.owned.has(slotId(sprite.id, v)) ? have : missing).push(entry);
    }
  }
  const list = (items, emptyMsg) =>
    items.length
      ? `<ul class="trade__list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
      : `<p class="trade__empty">${emptyMsg}</p>`;

  $('#trade-want').innerHTML = list(missing, t.trade.nothingMissing);
  $('#trade-have').innerHTML = list(have, t.trade.nothingOwned);
  $('#trade-want-count').textContent = missing.length;
  $('#trade-have-count').textContent = have.length;
}

function renderAll() {
  renderGrid();
  renderProgress();
  renderTrade();
}

function commit() {
  state.updatedAt = store.save(state.owned, state.mastered);
  renderAll();
  pousserPlusTard(); // regroupe les cases cochees a la suite
}

/* ------------------------------------------------- mise à jour ciblée */

/**
 * Réécrit une seule case, sans toucher au reste du DOM.
 *
 * Reconstruire toute la grille à chaque clic recréait près de 900 éléments et
 * une centaine d'images : mesuré à 33 ms en moyenne et jusqu'à 121 ms sur un
 * téléphone modeste, avec un scintillement des illustrations à chaque coche.
 */
function majCase(bouton, sprite, variante) {
  const niveau = levelOf(bouton.dataset.slot);
  const etat = [t.card.levelNone, t.card.levelOwned, t.card.levelMastered][niveau];
  const soon = isUnreleased(sprite, variante);

  bouton.dataset.level = niveau;
  bouton.title = soon ? `${t.card.unreleasedHint} — ${etat}` : etat;
  bouton.setAttribute('aria-label', `${nameOf(sprite)} ${t.variant[variante]} — ${etat}`);

  const couronne = $('.variant__crown', bouton);
  if (niveau === 2 && !couronne) {
    const span = document.createElement('span');
    span.className = 'variant__crown';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = COURONNE;
    // Avant l'étiquette « à venir » s'il y en a une, pour garder l'ordre du gabarit.
    bouton.insertBefore(span, $('.variant__soon', bouton));
  } else if (niveau !== 2 && couronne) {
    couronne.remove();
  }
}

/** Remet à jour l'entête d'une carte : compteur, barre et libellés des boutons. */
function majCarte(carte, sprite) {
  const owned = ownedCount(sprite);
  const total = sprite.variants.length;
  const complete = owned === total;

  carte.classList.toggle('is-complete', complete);
  surElement('.card__count', (el) => {
    el.textContent = fill(t.card.variantsOwned, { '%o': owned, '%t': total });
  }, carte);
  surElement('.meter i', (el) => (el.style.width = `${(owned / total) * 100}%`), carte);
  surElement('[data-toggle]', (el) => {
    el.textContent = complete ? t.card.uncheckAll : t.card.checkAll;
  }, carte);
  surElement('[data-master]', (el) => {
    el.textContent = allMastered(sprite) ? t.card.unmasterAll : t.card.masterAll;
  }, carte);

  // La coche « complet » n'existe dans le gabarit que lorsqu'elle s'applique.
  const done = $('.card__done', carte);
  if (complete && !done) {
    const span = document.createElement('span');
    span.className = 'card__done';
    span.title = t.card.complete;
    span.textContent = '✓';
    $('.card__head', carte).appendChild(span);
  } else if (!complete && done) {
    done.remove();
  }
}

/**
 * Enregistre puis rafraîchit le minimum.
 *
 * Si le Sprite ne correspond plus aux filtres (cocher la dernière case en vue
 * « Manquants », par exemple), il doit disparaître : là seulement on reconstruit
 * la grille, pour que l'affichage reste conforme au filtre demandé.
 */
function commitSprite(sprite) {
  state.updatedAt = store.save(state.owned, state.mastered);

  const carte = $(`.card[data-sprite="${sprite.id}"]`);
  if (!carte || !matchesFilters(sprite)) {
    renderGrid();
  } else {
    for (const bouton of $$('[data-slot]', carte)) {
      majCase(bouton, sprite, bouton.dataset.slot.split(':')[1]);
    }
    majCarte(carte, sprite);
  }

  renderProgress();
  invaliderTrade();
  pousserPlusTard();
}

/* --------------------------------------------------------------- actions */

function toggleSprite(spriteId) {
  const sprite = SPRITES.find((s) => s.id === spriteId);
  if (!sprite) return;
  const on = !isComplete(sprite);
  for (const v of shownVariants(sprite)) setLevel(slotId(sprite.id, v), on ? 1 : 0);
  commitSprite(sprite);
}

/**
 * Couronne toutes les variantes d'un Sprite, ou les ramène à « possédé » si
 * elles le sont déjà toutes. Retirer la couronne ne décoche jamais la case.
 */
function toggleMastery(spriteId) {
  const sprite = SPRITES.find((s) => s.id === spriteId);
  if (!sprite) return;
  const niveau = allMastered(sprite) ? 1 : 2;
  for (const v of shownVariants(sprite)) setLevel(slotId(sprite.id, v), niveau);
  commitSprite(sprite);
}

/* ------------------------------------------------------ verrou d'édition */

let verrouToast = null;

/** Un seul rappel à la fois, sinon les bannières s'empilent au moindre clic. */
function signalerVerrou() {
  if (verrouToast) return;
  verrouToast = toast(t.filters.lockedHint, {
    duration: 3000,
    action: {
      label: t.filters.unlock,
      run: () => setLock(false),
    },
  });
  setTimeout(() => {
    verrouToast = null;
  }, 3200);
}

/**
 * Applique le verrou. Seule la saisie est bloquée : filtres, tri, recherche,
 * comparaison, export et synchro continuent de fonctionner normalement.
 */
function setLock(verrouille, { silencieux = false } = {}) {
  state.locked = verrouille;
  store.savePref('locked', verrouille);

  document.body.classList.toggle('is-locked', verrouille);
  surElement('#lock-toggle', (el) => {
    const libelle = verrouille ? t.filters.unlock : t.filters.lock;
    el.setAttribute('aria-pressed', String(verrouille));
    // Sur petit écran le texte est masqué : il doit rester lisible au survol
    // comme au lecteur d'écran, sinon le bouton n'est qu'un cadenas muet.
    el.setAttribute('aria-label', libelle);
    el.setAttribute('title', libelle);
    surElement('.lock__label', (l) => (l.textContent = libelle), el);
  });
  // « Tout décocher » est le geste le plus coûteux : il suit le verrou.
  surElement('#reset', (el) => (el.disabled = verrouille));

  if (!silencieux) toast(verrouille ? t.filters.locked : t.filters.unlocked, { tone: verrouille ? 'warn' : 'ok' });
}

function flash(button, message) {
  const original = button.dataset.label || button.textContent.trim();
  button.dataset.label = original;
  button.textContent = message;
  button.classList.add('is-flashing');
  clearTimeout(button._flash);
  button._flash = setTimeout(() => {
    button.textContent = button.dataset.label;
    button.classList.remove('is-flashing');
  }, 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function exportImage() {
  const w = 1000;
  const h = 560;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0d1020');
  bg.addColorStop(1, '#1b1440');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText(t.trade.summaryTitle, 60, 96);

  const owned = ownedSlots();
  const pct = (owned / TOTAL_SLOTS) * 100;
  ctx.font = 'bold 120px system-ui, sans-serif';
  ctx.fillStyle = '#7ad0ff';
  ctx.fillText(`${pct.toFixed(1)} %`, 60, 220);

  ctx.font = '28px system-ui, sans-serif';
  ctx.fillStyle = '#c7cede';
  ctx.fillText(`${owned} / ${TOTAL_SLOTS} ${t.hero.slotsLabel}`, 60, 268);

  // Barre de progression
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(60, 300, w - 120, 22);
  const bar = ctx.createLinearGradient(60, 0, w - 60, 0);
  bar.addColorStop(0, '#7ad0ff');
  bar.addColorStop(1, '#c05cff');
  ctx.fillStyle = bar;
  ctx.fillRect(60, 300, (w - 120) * (pct / 100), 22);

  // Détail par rareté
  ctx.font = '24px system-ui, sans-serif';
  let y = 380;
  for (const r of RARITIES) {
    const list = SPRITES.filter((s) => s.rarity === r.id);
    const total = list.reduce((n, s) => n + s.variants.length, 0);
    const got = list.reduce((n, s) => n + ownedCount(s), 0);
    ctx.fillStyle = r.color;
    ctx.fillRect(60, y - 18, 14, 14);
    ctx.fillStyle = '#e8ecf6';
    ctx.fillText(`${t.rarity[r.id]} — ${got} / ${total}`, 88, y);
    y += 42;
  }

  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#8b93a7';
  ctx.fillText(window.location.host || 'spiritdex', 60, h - 40);

  const link = document.createElement('a');
  link.download = 'sprite-collection.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/* ------------------------------------------------- import depuis un lien */

function showImportDialog(incoming, incomingUpdatedAt = 0, incomingMastered = new Set()) {
  const dialog = $('#import-dialog');
  $('#import-compare').textContent = fill(t.trade.importCompare, {
    '%a': incoming.size,
    '%b': state.owned.size,
  });

  const apply = (mode) => {
    if (mode === 'replace') {
      state.owned = new Set(incoming);
      state.mastered = new Set(incomingMastered);
    } else if (mode === 'merge') {
      state.owned = new Set([...state.owned, ...incoming]);
      // La maîtrise se fusionne aussi : elle ne peut que monter, jamais redescendre.
      state.mastered = new Set([...state.mastered, ...incomingMastered]);
    }
    dialog.close();
    store.clearUrlCode();

    // « Remplacer » aligne l'appareil sur la version distante : on en reprend
    // l'horodatage, sinon la synchro croirait l'appareil plus récent et
    // renverrait aussitôt cette même version. Fusionner ou garder produisent
    // au contraire une version neuve, qui doit repartir vers le serveur.
    if (mode === 'replace' && incomingUpdatedAt) {
      state.updatedAt = incomingUpdatedAt;
      store.save(state.owned, state.mastered);
      renderAll();
    } else {
      commit();
    }
  };

  $$('[data-import]', dialog).forEach((btn) => {
    btn.onclick = () => apply(btn.dataset.import);
  });
  dialog.showModal();
}

function handleUrlCode() {
  const code = store.readUrlCode();
  if (!code) return;
  const lu = store.decode(code);
  if (!lu) return store.clearUrlCode();

  const memeContenu =
    lu.owned.size === state.owned.size &&
    lu.mastered.size === state.mastered.size &&
    [...lu.owned].every((s) => state.owned.has(s)) &&
    [...lu.mastered].every((s) => state.mastered.has(s));
  if (memeContenu) return store.clearUrlCode();

  if (state.owned.size === 0) {
    state.owned = lu.owned;
    state.mastered = lu.mastered;
    store.clearUrlCode();
    commit();
    return;
  }
  showImportDialog(lu.owned, 0, lu.mastered);
}

/* ------------------------------------------------------------- listeners */

/**
 * Si une illustration ne se charge pas, on retombe sur le dessin SVG généré
 * plutôt que d'afficher une icône cassée. L'évènement `error` d'une image ne
 * remonte pas : on l'intercepte en phase de capture.
 */
function bindImageFallback() {
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('sprite-img')) return;
      const sprite = SPRITE_INDEX[img.dataset.sprite];
      if (!sprite) return;
      img.outerHTML = spriteSvg(sprite, img.dataset.variant, Number(img.dataset.size) || 48);
    },
    true
  );
}

function bindEvents() {
  $('#grid').addEventListener('click', (e) => {
    const cible = e.target.closest('[data-slot], [data-toggle], [data-master]');
    if (!cible) return;

    // Verrou : on ne modifie rien, mais on dit pourquoi — un clic sans effet
    // et sans explication laisserait croire à une panne.
    if (state.locked) return signalerVerrou();

    if (cible.dataset.slot) {
      cycleLevel(cible.dataset.slot);
      return commitSprite(SPRITE_INDEX[cible.dataset.slot.split(':')[0]]);
    }
    if (cible.dataset.toggle) return toggleSprite(cible.dataset.toggle);
    toggleMastery(cible.dataset.master);
  });

  $('#lock-toggle').addEventListener('click', () => setLock(!state.locked));

  surElement('#season-switch', (el) => {
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-saison]');
      if (btn) changerSaison(btn.dataset.saison);
    });
  });

  $('#status-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    state.status = btn.dataset.status;
    $$('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    renderGrid();
  });

  const chipHandler = (container, set, key) => {
    $(container).addEventListener('click', (e) => {
      const btn = e.target.closest(`[data-${key}]`);
      if (!btn) return;
      const value = btn.dataset[key];
      if (set.has(value)) set.delete(value);
      else set.add(value);
      btn.setAttribute('aria-pressed', String(set.has(value)));
      renderGrid();
    });
  };
  chipHandler('#rarity-filters', state.rarities, 'rarity');
  chipHandler('#variant-filters', state.variants, 'variant');

  // Le repli est un choix d'affichage : il doit survivre au rechargement.
  surElement('#filtres-avances', (el) => {
    el.addEventListener('toggle', () => store.savePref('filtresOuverts', el.open));
  });

  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value.trim().toLowerCase();
    searchTimer = setTimeout(() => {
      state.query = value;
      renderGrid();
    }, 120);
  });

  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  $('#show-unreleased').addEventListener('change', (e) => {
    state.showUnreleased = e.target.checked;
    store.savePref('showUnreleased', state.showUnreleased);
    renderGrid();
    renderTrade();
  });

  $('#clear-filters').addEventListener('click', () => {
    state.status = 'all';
    state.rarities.clear();
    state.variants.clear();
    state.query = '';
    state.sort = 'rarity';
    $('#search').value = '';
    $('#sort').value = 'rarity';
    $$('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === 'all')));
    $$('#rarity-filters .chip, #variant-filters .chip').forEach((b) =>
      b.setAttribute('aria-pressed', 'false')
    );
    renderGrid();
  });

  $('#reset').addEventListener('click', () => {
    if (!confirm(t.hero.resetConfirm)) return;

    // Filet de sécurité : la confirmation du navigateur se clique trop vite pour
    // protéger d'un geste malheureux. On garde l'état d'avant le temps d'une
    // bannière, ce qui rend l'effacement réellement réversible.
    const avant = { owned: new Set(state.owned), mastered: new Set(state.mastered) };
    state.owned.clear();
    state.mastered.clear();
    commit();

    toast(t.hero.resetDone, {
      duration: 15000,
      tone: 'warn',
      action: {
        label: t.hero.undo,
        run: () => {
          state.owned = avant.owned;
          state.mastered = avant.mastered;
          commit();
          toast(t.hero.undone, { tone: 'ok' });
        },
      },
    });
  });

  $('#copy-link').addEventListener('click', async (e) => {
    if (await copyText(store.shareUrl(state.owned, state.mastered))) flash(e.currentTarget, t.trade.shareCopied);
  });

  $('#export-image').addEventListener('click', (e) => {
    exportImage();
    flash(e.currentTarget, t.trade.exportDone);
  });
}

/* ------------------------------------------------------- synchronisation */

const syncState = {
  config: null,
  profiles: {},
  enCours: false,
  // false tant que cet appareil ne s'est pas accordé avec le serveur : avant
  // cela, il n'a aucune raison de croire sa version plus complète.
  reconcilie: false,
};

const syncUi = () => ({
  form: $('#sync-form'),
  url: $('#sync-url'),
  room: $('#sync-room'),
  generate: $('#sync-generate'),
  profile: $('#sync-profile'),
  connect: $('#sync-connect'),
  now: $('#sync-now'),
  disconnect: $('#sync-disconnect'),
  state: $('#sync-state'),
  others: $('#sync-others'),
  list: $('#sync-profiles'),
});

let syncTimer;
function syncMessage(texte, type = '') {
  const el = $('#sync-state');
  el.textContent = texte;
  el.className = `sync__state ${type}`;
  clearTimeout(syncTimer);
  if (type !== 'is-ok') {
    syncTimer = setTimeout(() => {
      el.textContent = '';
      el.className = 'sync__state';
    }, 6000);
  }
}

const heure = () =>
  new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

/** Applique une collection distante en remplaçant l'actuelle. */
function appliquerDistant(owned, mastered, updatedAt) {
  state.owned = new Set(owned);
  state.mastered = new Set([...(mastered || [])].filter((s) => state.owned.has(s)));
  state.updatedAt = updatedAt || Date.now();
  store.save(state.owned, state.mastered);
  renderAll();
}

/**
 * Réconcilie l'appareil et le serveur pour NOTRE profil.
 * Le plus récent gagne ; en cas d'écart réel on laisse l'utilisateur trancher.
 */
async function synchroniser({ silencieux = false } = {}) {
  const config = syncState.config;
  if (!config || syncState.enCours) return;
  if (!navigator.onLine) {
    if (!silencieux) syncMessage(t.sync.offline);
    return;
  }

  syncState.enCours = true;
  if (!silencieux) syncMessage(t.sync.syncing);

  try {
    const profiles = await sync.pull(config);
    syncState.profiles = profiles;

    const distant = profiles[config.profile];
    const local = [...state.owned];
    const memeContenu =
      distant &&
      distant.owned.length === local.length &&
      distant.mastered.length === state.mastered.size &&
      local.every((s) => distant.owned.includes(s)) &&
      [...state.mastered].every((s) => distant.mastered.includes(s));

    // Cases présentes sur le serveur que cet appareil n'a pas : les pousser
    // telles quelles les effacerait.
    const effacerait = distant ? distant.owned.filter((s) => !state.owned.has(s)) : [];

    if (memeContenu) {
      syncMessage(fill(t.sync.synced, { '%d': heure() }), 'is-ok');
    } else if (state.owned.size === 0 && distant) {
      // Appareil vierge : on récupère simplement la collection du serveur.
      appliquerDistant(distant.owned, distant.mastered, distant.updatedAt);
      syncMessage(t.sync.pulled, 'is-ok');
    } else if (!distant || (distant.updatedAt < state.updatedAt && !effacerait.length)) {
      // L'appareil est en avance et n'efface rien : il fait autorité.
      await sync.push(config, state.owned, state.mastered, state.updatedAt || Date.now());
      syncMessage(fill(t.sync.synced, { '%d': heure() }), 'is-ok');
    } else if (distant.updatedAt < state.updatedAt && syncState.reconcilie) {
      // Décocher une case est légitime — mais seulement une fois que cet
      // appareil s'est déjà accordé avec le serveur au moins une fois.
      await sync.push(config, state.owned, state.mastered, state.updatedAt || Date.now());
      syncMessage(fill(t.sync.synced, { '%d': heure() }), 'is-ok');
    } else {
      // Premier accord après connexion, ou serveur plus récent : les deux
      // versions diffèrent vraiment, on laisse l'utilisateur trancher plutôt
      // que d'effacer quoi que ce soit.
      showImportDialog(new Set(distant.owned), distant.updatedAt, new Set(distant.mastered || []));
    }

    // À partir d'ici, cet appareil connaît l'état du serveur.
    syncState.reconcilie = true;

    renderSyncProfiles();
    if (document.body.classList.contains('is-comparing')) renderCompare();
  } catch (err) {
    syncMessage(fill(t.sync.failed, { '%d': err.message }), 'is-error');
  } finally {
    syncState.enCours = false;
  }
}

const pousserPlusTard = sync.debounce(() => {
  if (syncState.config) synchroniser({ silencieux: true });
}, 2500);

function renderSyncProfiles() {
  const ui = syncUi();
  const entrees = Object.entries(syncState.profiles);
  ui.others.hidden = !syncState.config;

  if (!entrees.length) {
    ui.list.innerHTML = `<li class="sync__empty">${t.sync.othersEmpty}</li>`;
    return;
  }

  ui.list.innerHTML = entrees
    .sort(([a], [b]) => a.localeCompare(b, lang))
    .map(([id, p]) => {
      const moi = id === syncState.config?.profile;
      const pct = ((p.count / TOTAL_SLOTS) * 100).toFixed(0);
      return `<li class="sync__profile${moi ? ' is-me' : ''}">
        <span class="sync__name">${p.name || id}${moi ? ` <em>(${t.sync.you})</em>` : ''}</span>
        <span class="sync__count">${p.count} / ${TOTAL_SLOTS} · ${pct} %</span>
        ${moi ? '' : `<button type="button" class="btn btn--ghost" data-compare="${id}">${t.sync.compare}</button>`}
      </li>`;
    })
    .join('');
}

/** Liste lisible des cases d'un ensemble, triée comme la grille. */
function libelles(slots) {
  return SPRITES.flatMap((s) =>
    [...s.variants, ...unreleasedOf(s)]
      .filter((v) => slots.has(slotId(s.id, v)))
      .map((v) => `${nameOf(s)} · ${t.variant[v]}`)
  );
}

function comparer(profileId) {
  const autre = syncState.profiles[profileId];
  if (!autre) return;

  const siens = new Set(autre.owned);
  const luiSeul = new Set([...siens].filter((s) => !state.owned.has(s)));
  const moiSeul = new Set([...state.owned].filter((s) => !siens.has(s)));
  const nom = autre.name || profileId;

  const bloc = (titre, ensemble) => {
    const items = libelles(ensemble);
    return `<div class="compare__col">
      <h4>${titre} <span>${items.length}</span></h4>
      ${
        items.length
          ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
          : `<p class="trade__empty">${t.sync.nothing}</p>`
      }
    </div>`;
  };

  $('#compare-body').innerHTML =
    bloc(fill(t.sync.theyHave, { '%d': nom }), luiSeul) +
    bloc(fill(t.sync.youHave, { '%d': nom }), moiSeul);
  $('#compare-dialog').showModal();
}

function appliquerConfigUi() {
  const ui = syncUi();
  const connecte = !!syncState.config;
  ui.connect.hidden = connecte;
  ui.now.hidden = !connecte;
  ui.disconnect.hidden = !connecte;
  ui.others.hidden = !connecte;
  ui.generate.disabled = connecte;
  [ui.url, ui.room, ui.profile].forEach((champ) => {
    champ.disabled = connecte;
  });
  if (connecte) {
    ui.url.value = syncState.config.url;
    ui.room.value = syncState.config.room;
    ui.profile.value = syncState.config.profile;
  }
}

/**
 * Réaffiche les derniers réglages connus dans le formulaire.
 * On ne tire un code de salon au hasard que s'il n'y a aucun historique : sinon
 * on effacerait sous les yeux de l'utilisateur la seule trace de son salon.
 */
function prefillDepuisMemoire({ ecraser = false } = {}) {
  const ui = syncUi();
  const dernier = sync.loadLastConfig();

  if (dernier) {
    // `ecraser` sert à l'import d'une sauvegarde : ses réglages font autorité,
    // y compris sur un code de salon tiré au hasard à l'ouverture.
    const poser = (champ, valeur) => {
      if (valeur && (ecraser || !champ.value)) champ.value = valeur;
    };
    poser(ui.url, dernier.url);
    poser(ui.room, dernier.room);
    poser(ui.profile, dernier.profile);
  } else if (!ui.room.value) {
    ui.room.value = sync.randomRoom();
  }
}

function bindSync() {
  const ui = syncUi();

  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (syncState.config) return;

    const config = {
      url: sync.normalizeUrl(ui.url.value),
      room: ui.room.value.trim(),
      profile: ui.profile.value.trim(),
    };

    if (!config.url || !config.room || !config.profile) {
      return syncMessage(t.sync.missing, 'is-error');
    }
    if (!sync.isValidUrl(config.url)) return syncMessage(t.sync.invalidUrl, 'is-error');
    // Le code du salon tient lieu de secret : trop court, il serait devinable.
    if (config.room.length < 12) return syncMessage(t.sync.shortRoom, 'is-error');

    syncMessage(t.sync.syncing);
    try {
      await sync.testConnection(config);
    } catch (err) {
      const message = /permission|denied/i.test(err.message)
        ? t.sync.denied
        : fill(t.sync.failed, { '%d': err.message });
      return syncMessage(message, 'is-error');
    }

    syncState.config = config;
    sync.saveConfig(config);
    sync.rememberConfig(config); // survit a une deconnexion ou a une perte
    appliquerConfigUi();
    await synchroniser();
  });

  ui.generate.addEventListener('click', () => {
    ui.room.value = sync.randomRoom();
    ui.room.focus();
  });

  ui.now.addEventListener('click', () => synchroniser());

  ui.disconnect.addEventListener('click', () => {
    syncState.config = null;
    syncState.profiles = {};
    syncState.reconcilie = false;
    sync.clearConfig();
    pousserPlusTard.cancel();
    appliquerConfigUi();
    // On laisse l'adresse et le code affiches : sans eux, impossible de revenir.
    prefillDepuisMemoire();
    syncMessage('');
    renderSyncProfiles();
  });

  ui.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-compare]');
    if (btn) comparer(btn.dataset.compare);
  });

  $('#compare-close').addEventListener('click', () => $('#compare-dialog').close());

  // Reprise dès que le réseau revient.
  window.addEventListener('online', () => {
    if (syncState.config) synchroniser({ silencieux: true });
  });

  syncState.config = sync.loadConfig();
  appliquerConfigUi();
  if (!syncState.config) prefillDepuisMemoire();
  if (syncState.config) synchroniser({ silencieux: true });
}

/* ------------------------------------------------------------ bannières */

/**
 * Petite bannière en bas de l'écran.
 * @param {string} message
 * @param {{action?: {label:string, run:Function}, duration?:number, tone?:string}} options
 *        `duration: 0` garde la bannière jusqu'à une action ou une fermeture.
 * @returns {{close:Function, element:HTMLElement}}
 */
function toast(message, { action, duration = 5000, tone = '' } = {}) {
  const el = document.createElement('div');
  el.className = `toast${tone ? ` toast--${tone}` : ''}`;
  el.innerHTML = `<span class="toast__text"></span>
    ${action ? `<button type="button" class="toast__action"></button>` : ''}
    <button type="button" class="toast__close" aria-label="Fermer">✕</button>`;
  $('.toast__text', el).textContent = message;

  const close = () => {
    el.classList.add('is-leaving');
    // Laisse l'animation de sortie se jouer avant de retirer l'élément.
    setTimeout(() => el.remove(), 220);
  };

  if (action) {
    const btn = $('.toast__action', el);
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.run();
      close();
    });
  }
  $('.toast__close', el).addEventListener('click', close);

  $('#toasts').appendChild(el);
  // Force un reflow pour que la transition d'entrée démarre.
  requestAnimationFrame(() => el.classList.add('is-in'));

  if (duration > 0) setTimeout(close, duration);
  return { close, element: el };
}

/* ------------------------------------------------- onglet « comparer » */

const compareState = {
  who: null, // identifiant du profil comparé
  filter: 'theyHelp',
};

/** Les quatre familles de cases, dans l'ordre d'intérêt pour un échange. */
const CATEGORIES = ['theyHelp', 'youHelp', 'both', 'neither'];

/**
 * Range chaque case dans une famille selon qui la possède.
 * @returns {{theyHelp:string[], youHelp:string[], both:string[], neither:string[]}}
 */
function classerCases(autre) {
  const siens = new Set(autre.owned);
  const groupes = { theyHelp: [], youHelp: [], both: [], neither: [] };

  for (const sprite of SPRITES) {
    for (const v of shownVariants(sprite)) {
      const id = slotId(sprite.id, v);
      const moi = state.owned.has(id);
      const lui = siens.has(id);
      const famille = moi && lui ? 'both' : lui ? 'theyHelp' : moi ? 'youHelp' : 'neither';
      groupes[famille].push(id);
    }
  }
  return groupes;
}

function carteVersus(nom, owned, mastered, aMoi) {
  const pct = ((owned / TOTAL_SLOTS) * 100).toFixed(0);
  return `<div class="versus__side${aMoi ? ' is-me' : ''}">
    <span class="versus__who">${nom}</span>
    <span class="versus__pct">${pct} %</span>
    <div class="meter"><i style="width:${pct}%"></i></div>
    <span class="versus__detail">${owned} / ${TOTAL_SLOTS} · ${mastered} ${t.compare.mastered}</span>
  </div>`;
}

function renderCompare() {
  const setup = $('#compare-setup');
  const principal = $('#compare-main');
  const autres = Object.entries(syncState.profiles).filter(
    ([id]) => id !== syncState.config?.profile
  );

  // Deux raisons de ne rien pouvoir comparer : pas de synchro, ou personne d'autre.
  if (!syncState.config || !autres.length) {
    $('#compare-setup-msg').textContent = syncState.config ? t.compare.alone : t.compare.needSync;
    $('#compare-goto-sync').hidden = !!syncState.config;
    setup.hidden = false;
    principal.hidden = true;
    return;
  }
  setup.hidden = true;
  principal.hidden = false;

  if (!compareState.who || !syncState.profiles[compareState.who]) {
    compareState.who = autres[0][0];
  }
  const autre = syncState.profiles[compareState.who];

  $('#compare-who').innerHTML = autres
    .map(
      ([id, p]) =>
        `<option value="${id}"${id === compareState.who ? ' selected' : ''}>${p.name || id}</option>`
    )
    .join('');

  const moi = syncState.profiles[syncState.config.profile];
  $('#compare-versus').innerHTML =
    carteVersus(t.compare.you, state.owned.size, state.mastered.size, true) +
    '<span class="versus__vs">vs</span>' +
    carteVersus(autre.name || compareState.who, autre.owned.length, autre.mastered.length, false);

  const groupes = classerCases(autre);

  $('#compare-filters').innerHTML = CATEGORIES.map(
    (c) => `<button type="button" class="chip chip--${c}" data-cat="${c}"
      aria-pressed="${compareState.filter === c}">${t.compare[c]} <b>${groupes[c].length}</b></button>`
  ).join('');

  const retenues = new Set(groupes[compareState.filter]);
  $('#compare-count').textContent = t.compare[`${compareState.filter}Hint`] || '';

  const siens = new Set(autre.owned);
  const siensMaitrises = new Set(autre.mastered);

  const cartes = SPRITES.map((sprite) => {
    const cases = shownVariants(sprite).filter((v) => retenues.has(slotId(sprite.id, v)));
    if (!cases.length) return '';

    const tuiles = cases
      .map((v) => {
        const id = slotId(sprite.id, v);
        const moiNiveau = levelOf(id);
        const luiNiveau = siensMaitrises.has(id) ? 2 : siens.has(id) ? 1 : 0;
        const pastille = (niveau, libelle) =>
          `<span class="dot dot--${niveau}" title="${libelle}">${niveau === 2 ? '♛' : niveau === 1 ? '✓' : '·'}</span>`;
        return `<div class="cmp-tile" style="${variantChipStyle(v)}">
          <span class="cmp-tile__art">${spriteImg(sprite, v, 40, '')}</span>
          <span class="cmp-tile__name">${t.variant[v]}</span>
          <span class="cmp-tile__dots">
            ${pastille(moiNiveau, t.compare.legendYou)}${pastille(luiNiveau, t.compare.legendThem)}
          </span>
        </div>`;
      })
      .join('');

    const rarete = RARITY_INDEX[sprite.rarity];
    return `<article class="card cmp-card" style="--rarity:${rarete.color}">
      <header class="card__head">
        <span class="card__art">${spriteImg(sprite, 'normal', 56, nameOf(sprite))}</span>
        <span class="card__id">
          <h3 class="card__name">${nameOf(sprite)}</h3>
          <span class="badge">${t.rarity[sprite.rarity]}</span>
        </span>
        <span class="cmp-card__count">${cases.length}</span>
      </header>
      <div class="cmp-tiles">${tuiles}</div>
    </article>`;
  }).join('');

  $('#compare-grid').innerHTML = cartes || `<p class="empty">${t.compare.empty}</p>`;
}

/** Liste formatée de ce que l'autre possède et pas nous, prête pour Discord. */
function listeManques() {
  const autre = syncState.profiles[compareState.who];
  if (!autre) return '';
  const siens = new Set(autre.owned);
  const lignes = [];

  for (const sprite of SPRITES) {
    const manques = shownVariants(sprite).filter(
      (v) => siens.has(slotId(sprite.id, v)) && !state.owned.has(slotId(sprite.id, v))
    );
    if (manques.length) lignes.push(`• ${nameOf(sprite)} : ${manques.map((v) => t.variant[v]).join(', ')}`);
  }
  const nom = autre.name || compareState.who;
  return [
    `**${fill(t.compare.theyHelp, {})} — ${nom}**`,
    lignes.length ? lignes.join('\n') : t.compare.empty,
  ].join('\n');
}

/** Bascule entre la vue normale et l'onglet de comparaison. */
function showCompare(actif) {
  document.body.classList.toggle('is-comparing', actif);
  $$('main > section').forEach((sec) => {
    if (sec.id === 'comparer') sec.hidden = !actif;
    else sec.hidden = actif;
  });
  $$('.site-nav a').forEach((a) =>
    a.classList.toggle('is-active', actif && a.getAttribute('href') === '#comparer')
  );
  if (actif) {
    if (!tradeAJour) renderTrade(); // périmée pendant qu'on cochait
    renderCompare();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function bindCompare() {
  // Navigation : « Comparer » ouvre l'onglet, tout autre lien revient à la vue normale.
  $$('.site-nav a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const cible = a.getAttribute('href');
      if (cible === '#comparer') {
        e.preventDefault();
        history.replaceState(null, '', '#comparer');
        showCompare(true);
      } else if (document.body.classList.contains('is-comparing')) {
        showCompare(false);
      }
    });
  });

  $('#compare-who').addEventListener('change', (e) => {
    compareState.who = e.target.value;
    renderCompare();
  });

  $('#compare-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    compareState.filter = btn.dataset.cat;
    renderCompare();
  });

  $('#compare-refresh').addEventListener('click', async () => {
    await synchroniser();
    renderCompare();
  });

  $('#compare-copy').addEventListener('click', async (e) => {
    if (await copyText(listeManques())) flash(e.currentTarget, t.compare.copied);
  });

  $('#compare-goto-sync').addEventListener('click', () => showCompare(false));

  // Lien direct vers #comparer, y compris depuis un signet
  if (location.hash === '#comparer') showCompare(true);
}

/* ------------------------------------------- sauvegarde fichier & install */

function telecharger(nom, contenu, type) {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  // Laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exporterSauvegarde() {
  const data = store.buildBackup(state.owned, state.mastered, syncState.config || sync.loadLastConfig());
  const date = new Date().toISOString().slice(0, 10);
  telecharger(`spiritdex-${date}.json`, JSON.stringify(data, null, 2), 'application/json');
  store.savePref('lastBackup', Date.now());
  // On retient aussi l'ampleur de la collection sauvegardée : c'est ce qui
  // permet de savoir plus tard si le fichier est devenu très incomplet.
  store.savePref('lastBackupCount', ownedSlots());
}

/** Seuil à partir duquel une collection mérite d'être mise à l'abri. */
const RAPPEL_SEUIL = 15;
/** Plus haut quand la synchro tourne : la collection est déjà sur le serveur. */
const RAPPEL_SEUIL_SYNCHRO = 40;
/** Cases gagnées depuis le dernier export avant de relancer le rappel. */
const RAPPEL_CROISSANCE = 20;

/**
 * Rappelle d'exporter une sauvegarde.
 *
 * Un seul rappel « au premier remplissage » ne suffit pas : après un export à
 * 20 cases, un joueur monté à 100 n'était plus jamais relancé alors que son
 * fichier ne valait presque plus rien. Le rappel revient donc quand la
 * collection a nettement grossi depuis la dernière sauvegarde.
 *
 * La synchro ne fait plus taire le rappel, elle en relève seulement le seuil :
 * si le code du salon est perdu, un fichier reste le dernier recours.
 */
function rappelSauvegarde() {
  const coches = ownedSlots();
  if (coches < (syncState.config ? RAPPEL_SEUIL_SYNCHRO : RAPPEL_SEUIL)) return;

  const dernier = store.loadPref('lastBackup', 0);
  const auDernierExport = store.loadPref('lastBackupCount', 0);
  if (dernier && coches - auDernierExport < RAPPEL_CROISSANCE) return;

  const message = dernier
    ? fill(t.backup.remindStale, { '%d': coches, '%a': auDernierExport })
    : fill(t.backup.remind, { '%d': coches });

  toast(message, {
    duration: 12000,
    tone: 'warn',
    action: {
      label: t.backup.remindAction,
      run: () => exporterSauvegarde(),
    },
  });
}

async function importerSauvegarde(file) {
  const texte = await file.text();
  const lu = store.readBackup(texte);
  if (lu && lu.autreSaison) {
    etat(t.season.otherSeasonBackup, true);
    return;
  }
  if (!lu) {
    etat(t.backup.importError, true);
    return;
  }
  // La sauvegarde transporte les réglages de synchro : on les remet en mémoire
  // pour que l'accès au salon soit récupérable, sans reconnecter d'autorité.
  if (lu.sync) {
    sync.rememberConfig(lu.sync);
    if (!syncState.config) prefillDepuisMemoire({ ecraser: true });
  }
  // Même arbitrage que pour un lien partagé : remplacer, fusionner ou annuler.
  if (state.owned.size === 0) {
    state.owned = lu.owned;
    state.mastered = lu.mastered || new Set();
    commit();
    etat(fill(t.card.variantsOwned, { '%o': state.owned.size, '%t': TOTAL_SLOTS }));
    return;
  }
  showImportDialog(lu.owned, 0, lu.mastered);
}

let etatTimer;
function etat(message, erreur = false) {
  const el = $('#backup-state');
  el.textContent = message;
  el.classList.toggle('is-error', erreur);
  clearTimeout(etatTimer);
  etatTimer = setTimeout(() => {
    el.textContent = '';
    el.classList.remove('is-error');
  }, 5000);
}

function bindBackup() {
  $('#export-backup').addEventListener('click', (e) => {
    exporterSauvegarde();
    flash(e.currentTarget, t.backup.exported);
  });

  $('#import-backup').addEventListener('click', () => $('#backup-file').click());

  $('#backup-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await importerSauvegarde(file);
    e.target.value = ''; // permet de réimporter le même fichier
  });
}

function bindPwa() {
  const bouton = $('#install-app');
  const conseil = $('.backup__hint');
  let invitePossible = false;

  const installer = trackInstall((installable) => {
    invitePossible = installable;
    bouton.hidden = !installable;
    if (installable) conseil.textContent = t.backup.installHint;
  });
  bouton.addEventListener('click', () => installer());

  /**
   * Le bouton ne peut apparaître que si le navigateur propose une invite.
   * Sur iOS il n'y en a jamais, et sur Android elle peut tarder : sans
   * explication, l'utilisateur croit que l'installation est impossible.
   */
  const expliquerInstallation = () => {
    if (estInstallee()) {
      bouton.hidden = true;
      conseil.textContent = t.backup.installedAlready;
    } else if (!invitePossible) {
      // On se fie à la capacité du navigateur plutôt qu'à son identité : sans
      // `beforeinstallprompt`, aucune invite ne viendra jamais et l'installation
      // sera forcément manuelle (Safari, iOS, Firefox…).
      const inviteSupportee = 'onbeforeinstallprompt' in window;
      conseil.textContent =
        estIos() || !inviteSupportee ? t.backup.installIos : t.backup.installAndroid;
    }
  };
  expliquerInstallation();
  // `beforeinstallprompt` arrive parfois après le chargement : on laisse sa chance.
  setTimeout(expliquerInstallation, 2500);

  // Une nouvelle version en attente : on propose, on n'impose pas. La bannière
  // reste jusqu'à ce que l'utilisateur tranche, sinon elle passerait inaperçue.
  registerServiceWorker((reg) => {
    toast(t.backup.updateReady, {
      duration: 0,
      tone: 'update',
      action: {
        label: t.backup.updateApply,
        run: () => {
          toast(t.backup.updateDoing, { duration: 3000 });
          // Marque le rechargement pour pouvoir confirmer une fois revenu.
          try {
            sessionStorage.setItem('sprite-tracker:updated', '1');
          } catch {
            /* stockage indisponible : on perd juste la confirmation */
          }
          applyUpdate(reg);
        },
      },
    });
  });

  // Retour après une mise à jour appliquée : on confirme brièvement.
  try {
    if (sessionStorage.getItem('sprite-tracker:updated')) {
      sessionStorage.removeItem('sprite-tracker:updated');
      toast(t.backup.updateDone, { tone: 'ok' });
    }
  } catch {
    /* rien à confirmer */
  }

  let bandeauHorsLigne = null;
  const majReseau = () => {
    const horsLigne = !navigator.onLine;
    document.body.classList.toggle('is-offline', horsLigne);
    if (horsLigne && !bandeauHorsLigne) {
      bandeauHorsLigne = toast(t.backup.offline, { duration: 0, tone: 'warn' });
    } else if (!horsLigne && bandeauHorsLigne) {
      bandeauHorsLigne.close();
      bandeauHorsLigne = null;
    }
  };
  window.addEventListener('online', majReseau);
  window.addEventListener('offline', majReseau);
  majReseau();
}


/* ------------------------------------------------------------------ init */

/**
 * Applique une modification à un élément seulement s'il existe.
 *
 * Un élément absent ne doit jamais interrompre le démarrage : c'est ce qui est
 * arrivé quand une page récente s'est retrouvée servie avec un app.js périmé
 * qui cherchait un bouton supprimé — toute la page restait vide.
 */
function surElement(selecteur, action, racine = document) {
  const el = $(selecteur, racine);
  if (el) action(el);
}

/** Date ISO rendue lisible, ou telle quelle si elle est illisible. */
function dateLisible(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
}

function applyStrings() {
  document.title = t.meta.title;
  surElement('meta[name="description"]', (el) => el.setAttribute('content', t.meta.description));
  $$('[data-t]').forEach((el) => {
    const path = el.dataset.t.split('.');
    const value = path.reduce((o, k) => (o ? o[k] : undefined), t);
    if (typeof value === 'string') el.textContent = value;
  });
  surElement('#search', (el) => {
    el.placeholder = t.filters.search;
    el.setAttribute('aria-label', t.filters.searchLabel);
  });
  surElement('#total-slots', (el) => (el.textContent = TOTAL_SLOTS));
  surElement('#total-sprites', (el) => (el.textContent = SPRITES.length));

  // Date de dernière vérification des données : dit d'un coup d'œil si le site
  // a été mis à jour depuis la dernière saison.
  surElement('#data-date', (el) => {
    const lisible = dateLisible(DATA_DATE);
    el.textContent = fill(t.hero.dataDate, { '%d': lisible });
  });

  // Les taux d'apparition ont leur propre date : ils changent à chaque patch,
  // indépendamment du reste des données.
  surElement('#drop-source', (el) => {
    el.hidden = !DROP_DATE;
    el.textContent = DROP_DATE ? fill(t.card.dropSource, { '%d': dateLisible(DROP_DATE) }) : '';
  });
}

function init() {
  // Avant toute lecture : la saison détermine la clé de stockage.
  setSaison(store.loadPref('saison', SAISON_DEFAUT));

  const saved = store.load();
  state.owned = saved.owned;
  state.mastered = saved.mastered;
  state.updatedAt = saved.updatedAt;

  // Le stockage contenait d'anciens identifiants : on le réécrit au vocabulaire
  // courant, en gardant l'horodatage d'origine. Sans cela la migration serait
  // refaite à chaque ouverture ; avec un horodatage neuf, la synchro croirait
  // cet appareil plus récent que le serveur et écraserait ce qu'il contient.
  if (saved.migrated) store.save(state.owned, state.mastered, state.updatedAt);
  state.showUnreleased = store.loadPref('showUnreleased', false);
  $('#show-unreleased').checked = state.showUnreleased;

  // Replié par défaut sur téléphone, ouvert sur grand écran où la place existe.
  surElement('#filtres-avances', (el) => {
    el.open = store.loadPref('filtresOuverts', window.innerWidth > 640);
  });

  applyStrings();
  renderSaisons();
  renderFilters();
  renderAll();
  // Silencieux : au chargement, le verrou n'est pas une nouvelle à annoncer.
  setLock(store.loadPref('locked', false), { silencieux: true });
  bindImageFallback();
  bindEvents();
  bindBackup();
  bindPwa();
  bindSync();
  bindCompare();

  // Signale au secours placé dans le HTML que l'application a bien démarré.
  window.__spriteDemarre = true;
  handleUrlCode();

  // Laisse la page s'installer avant d'ajouter une bannière de plus.
  setTimeout(rappelSauvegarde, 4000);
}

init();
