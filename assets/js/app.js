import {
  SPRITES,
  VARIANTS,
  RARITIES,
  RARITY_INDEX,
  VARIANT_INDEX,
  TOTAL_SLOTS,
  unreleasedOf,
} from './data.js';
import { getStrings } from './i18n.js';
import { spriteSvg, variantChipStyle } from './art.js';
import * as store from './store.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
const t = getStrings(lang);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  owned: new Set(),
  status: 'all', // all | owned | missing
  rarities: new Set(),
  variants: new Set(),
  query: '',
  sort: 'rarity',
  showUnreleased: false,
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

function abilityText(sprite) {
  return sprite.ability.verified ? t.ability[sprite.id] : t.card.abilityUnknown;
}

function formatDrop(rate) {
  const digits = rate < 0.01 ? 5 : rate < 1 ? 2 : 1;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(rate) + ' %';
}

function fill(str, map) {
  return Object.entries(map).reduce((s, [k, v]) => s.split(k).join(v), str);
}

/* ------------------------------------------------------------- rendering */

function renderFilters() {
  $('#rarity-filters').innerHTML = RARITIES.map(
    (r) => `<button type="button" class="chip chip--rarity" data-rarity="${r.id}"
      style="--chip-a:${r.color};--chip-b:${r.color}" aria-pressed="false">${t.rarity[r.id]}</button>`
  ).join('');

  $('#variant-filters').innerHTML = VARIANTS.map(
    (v) => `<button type="button" class="chip" data-variant="${v.id}"
      style="${variantChipStyle(v.id)}" aria-pressed="false">${t.variant[v.id]}</button>`
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
  return true;
}

function sortSprites(list) {
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), lang);
  const sorters = {
    rarity: (a, b) => RARITY_INDEX[a.rarity].order - RARITY_INDEX[b.rarity].order || byName(a, b),
    name: byName,
    progress: (a, b) =>
      ownedCount(b) / b.variants.length - ownedCount(a) / a.variants.length || byName(a, b),
    drop: (a, b) => a.dropRate - b.dropRate || byName(a, b),
  };
  return [...list].sort(sorters[state.sort] || sorters.rarity);
}

function cardHtml(sprite) {
  const owned = ownedCount(sprite);
  const total = sprite.variants.length;
  const complete = owned === total;
  const rarity = RARITY_INDEX[sprite.rarity];

  const variants = shownVariants(sprite)
    .map((v) => {
      const id = slotId(sprite.id, v);
      const checked = state.owned.has(id);
      const dim = state.variants.size && !state.variants.has(v) ? ' is-dimmed' : '';
      const soon = isUnreleased(sprite, v) ? ' is-unreleased' : '';
      const title = soon ? ` title="${t.card.unreleasedHint}"` : '';
      return `<label class="variant${checked ? ' is-owned' : ''}${dim}${soon}" style="${variantChipStyle(v)}"${title}>
        <input type="checkbox" data-slot="${id}" ${checked ? 'checked' : ''}>
        <span class="variant__art">${spriteSvg(sprite, v, 40)}</span>
        <span class="variant__name">${t.variant[v]}</span>
        ${soon ? `<span class="variant__soon">${t.card.unreleasedTag}</span>` : ''}
      </label>`;
    })
    .join('');

  return `<article class="card${complete ? ' is-complete' : ''}" data-sprite="${sprite.id}"
      style="--rarity:${rarity.color}">
    <header class="card__head">
      <span class="card__art">${spriteSvg(sprite, 'normal', 56)}</span>
      <span class="card__id">
        <h3 class="card__name">${nameOf(sprite)}</h3>
        <span class="badge">${t.rarity[sprite.rarity]}</span>
      </span>
      ${complete ? `<span class="card__done" title="${t.card.complete}">✓</span>` : ''}
    </header>
    <p class="card__ability${sprite.ability.verified ? '' : ' is-muted'}">
      <b>${t.card.ability} :</b> ${abilityText(sprite)}
    </p>
    <p class="card__drop"><b>${t.card.dropRate} :</b> ${formatDrop(sprite.dropRate)}</p>
    <div class="card__meter">
      <div class="meter"><i style="width:${(owned / total) * 100}%"></i></div>
      <span class="card__count">${fill(t.card.variantsOwned, { '%o': owned, '%t': total })}</span>
    </div>
    <div class="variants">${variants}</div>
    <button type="button" class="card__toggle" data-toggle="${sprite.id}">
      ${complete ? t.card.uncheckAll : t.card.checkAll}
    </button>
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
}

function renderProgress() {
  const slots = ownedSlots();
  const pct = TOTAL_SLOTS ? (slots / TOTAL_SLOTS) * 100 : 0;
  const unlocked = SPRITES.filter((s) => ownedCount(s) > 0).length;
  const completed = SPRITES.filter(isComplete).length;

  $('#progress-pct').textContent = `${pct.toFixed(1).replace('.', lang === 'fr' ? ',' : '.')} %`;
  $('#progress-slots').textContent = `${slots} / ${TOTAL_SLOTS}`;
  $('#progress-sprites').textContent = `${unlocked} / ${SPRITES.length}`;
  $('#progress-complete').textContent = `${completed} / ${SPRITES.length}`;
  $('#progress-ring').style.setProperty('--pct', pct.toFixed(2));
  $('#progress-ring').setAttribute('aria-valuenow', pct.toFixed(1));
}

function renderTrade() {
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
  store.save(state.owned);
  renderAll();
}

/* --------------------------------------------------------------- actions */

function toggleSlot(id, on) {
  if (on) state.owned.add(id);
  else state.owned.delete(id);
}

function toggleSprite(spriteId) {
  const sprite = SPRITES.find((s) => s.id === spriteId);
  if (!sprite) return;
  const on = !isComplete(sprite);
  for (const v of shownVariants(sprite)) toggleSlot(slotId(sprite.id, v), on);
  commit();
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

function discordSummary() {
  const owned = ownedSlots();
  const pct = ((owned / TOTAL_SLOTS) * 100).toFixed(1);
  const lines = [
    `**${t.trade.summaryTitle}** — ${owned}/${TOTAL_SLOTS} (${pct}%)`,
    '',
    `__${t.trade.want}__`,
  ];
  const missing = [];
  for (const sprite of SPRITES) {
    const gaps = sprite.variants.filter((v) => !state.owned.has(slotId(sprite.id, v)));
    if (gaps.length) missing.push(`• ${nameOf(sprite)} : ${gaps.map((v) => t.variant[v]).join(', ')}`);
  }
  lines.push(missing.length ? missing.join('\n') : t.trade.nothingMissing);
  lines.push('', store.shareUrl(state.owned));
  return lines.join('\n');
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
  ctx.fillText(window.location.host || 'sprite-tracker', 60, h - 40);

  const link = document.createElement('a');
  link.download = 'sprite-collection.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/* ------------------------------------------------- import depuis un lien */

function showImportDialog(incoming) {
  const dialog = $('#import-dialog');
  $('#import-compare').textContent = fill(t.trade.importCompare, {
    '%a': incoming.size,
    '%b': state.owned.size,
  });

  const apply = (mode) => {
    if (mode === 'replace') state.owned = new Set(incoming);
    else if (mode === 'merge') state.owned = new Set([...state.owned, ...incoming]);
    dialog.close();
    store.clearUrlCode();
    commit();
  };

  $$('[data-import]', dialog).forEach((btn) => {
    btn.onclick = () => apply(btn.dataset.import);
  });
  dialog.showModal();
}

function handleUrlCode() {
  const code = store.readUrlCode();
  if (!code) return;
  const incoming = store.decode(code);
  if (!incoming) return store.clearUrlCode();

  const same =
    incoming.size === state.owned.size && [...incoming].every((s) => state.owned.has(s));
  if (same) return store.clearUrlCode();

  if (state.owned.size === 0) {
    state.owned = incoming;
    store.clearUrlCode();
    commit();
    return;
  }
  showImportDialog(incoming);
}

/* ------------------------------------------------------------- listeners */

function bindEvents() {
  $('#grid').addEventListener('change', (e) => {
    const box = e.target.closest('input[data-slot]');
    if (!box) return;
    toggleSlot(box.dataset.slot, box.checked);
    commit();
  });

  $('#grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (btn) toggleSprite(btn.dataset.toggle);
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
    state.owned.clear();
    commit();
  });

  $('#copy-discord').addEventListener('click', async (e) => {
    if (await copyText(discordSummary())) flash(e.currentTarget, t.trade.copied);
  });

  $('#copy-link').addEventListener('click', async (e) => {
    if (await copyText(store.shareUrl(state.owned))) flash(e.currentTarget, t.trade.shareCopied);
  });

  $('#export-image').addEventListener('click', (e) => {
    exportImage();
    flash(e.currentTarget, t.trade.exportDone);
  });

  $('#faq').addEventListener('click', (e) => {
    const q = e.target.closest('.faq__q');
    if (!q) return;
    const item = q.parentElement;
    const open = item.hasAttribute('open');
    q.setAttribute('aria-expanded', String(!open));
  });

  // Le lien de langue conserve le code de partage.
  const langLink = $('#lang-link');
  langLink.addEventListener('click', (e) => {
    e.preventDefault();
    const url = new URL(t.nav.langHref, window.location.href);
    if (state.owned.size) url.searchParams.set('c', store.encode(state.owned));
    window.location.href = url.toString();
  });
}

/* -------------------------------------------------------- contenu statique */

function renderVariantLegend() {
  $('#variant-legend').innerHTML = VARIANTS.map((v) => {
    const sample = SPRITES.find((s) => s.variants.includes(v.id)) || SPRITES[0];
    const count = SPRITES.filter((s) => s.variants.includes(v.id)).length;
    return `<li class="legend__item" style="${variantChipStyle(v.id)}">
      <span class="legend__art">${spriteSvg(sample, v.id, 52)}</span>
      <h3>${t.variant[v.id]}</h3>
      <p>${t.variantDesc[v.id]}</p>
      <span class="legend__count">${count} / ${SPRITES.length} Sprites</span>
    </li>`;
  }).join('');
}

function renderFaq() {
  $('#faq').innerHTML = t.faq.items
    .map((item) => {
      const answer = fill(item.a, { '%s': SPRITES.length, '%v': TOTAL_SLOTS });
      return `<details class="faq__item">
        <summary class="faq__q" aria-expanded="false">${item.q}</summary>
        <div class="faq__a"><p>${answer}</p></div>
      </details>`;
    })
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: fill(item.a, { '%s': SPRITES.length, '%v': TOTAL_SLOTS }),
      },
    })),
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

/* ------------------------------------------------------------------ init */

function applyStrings() {
  document.title = t.meta.title;
  $('meta[name="description"]').setAttribute('content', t.meta.description);
  $$('[data-t]').forEach((el) => {
    const path = el.dataset.t.split('.');
    const value = path.reduce((o, k) => (o ? o[k] : undefined), t);
    if (typeof value === 'string') el.textContent = value;
  });
  $('#search').placeholder = t.filters.search;
  $('#search').setAttribute('aria-label', t.filters.searchLabel);
  $('#lang-link').href = t.nav.langHref;
  $('#total-slots').textContent = TOTAL_SLOTS;
  $('#total-sprites').textContent = SPRITES.length;
}

function init() {
  const saved = store.load();
  state.owned = saved.owned;
  state.showUnreleased = store.loadPref('showUnreleased', false);
  $('#show-unreleased').checked = state.showUnreleased;

  applyStrings();
  renderFilters();
  renderVariantLegend();
  renderFaq();
  renderAll();
  bindEvents();
  handleUrlCode();
}

init();
