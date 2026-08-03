/*
 * Persistance locale + encodage du code de partage.
 *
 * Le code de partage est un champ de bits sur ALL_SLOTS (ordre stable défini
 * dans data.js), préfixé d'un octet de version, encodé en base64url. Ajouter un
 * Sprite en fin de liste reste compatible avec les anciens codes ; réordonner
 * ALL_SLOTS ne l'est pas — d'où l'octet de version.
 */

import { ALL_SLOTS } from './data.js';

const KEY = 'sprite-tracker:v3';
const ANCIENNE_CLE = 'sprite-tracker:v2';
// v3 : chaque case a deux niveaux — possédé, puis maîtrisé. Le code de partage
// contient donc deux champs de bits successifs au lieu d'un.
const CODE_VERSION = 3;

/**
 * @returns {{owned:Set<string>, mastered:Set<string>, updatedAt:number}}
 * `mastered` est toujours un sous-ensemble de `owned`.
 */
export function load() {
  const vide = { owned: new Set(), mastered: new Set(), updatedAt: 0 };
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(ANCIENNE_CLE);
    if (!raw) return vide;
    const parsed = JSON.parse(raw);
    const owned = new Set(Array.isArray(parsed.owned) ? parsed.owned : []);
    // Les sauvegardes v2 ne connaissent pas la maîtrise : tout reste « possédé ».
    const mastered = new Set(
      (Array.isArray(parsed.mastered) ? parsed.mastered : []).filter((s) => owned.has(s))
    );
    return { owned, mastered, updatedAt: Number(parsed.updatedAt) || 0 };
  } catch {
    return vide;
  }
}

export function save(owned, mastered = new Set()) {
  const payload = {
    owned: [...owned],
    mastered: [...mastered].filter((s) => owned.has(s)),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* mode privé ou quota plein : la session reste utilisable en mémoire */
  }
  return payload.updatedAt;
}

const PREF_KEY = 'sprite-tracker:prefs';

/** Préférences d'affichage, indépendantes de la collection. */
export function loadPref(name, fallback) {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return name in prefs ? prefs[name] : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(name, value) {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    prefs[name] = value;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* stockage indisponible : la préférence vaut pour la session seulement */
  }
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const OCTETS = Math.ceil(ALL_SLOTS.length / 8);

/** Un octet de version, puis le champ « possédé », puis le champ « maîtrisé ». */
export function encode(owned, mastered = new Set()) {
  const bits = new Uint8Array(1 + OCTETS * 2);
  bits[0] = CODE_VERSION;
  ALL_SLOTS.forEach((slot, i) => {
    if (owned.has(slot)) bits[1 + (i >> 3)] |= 1 << (i & 7);
    if (mastered.has(slot)) bits[1 + OCTETS + (i >> 3)] |= 1 << (i & 7);
  });
  return bytesToBase64Url(bits);
}

/**
 * @returns {{owned:Set<string>, mastered:Set<string>}|null}
 *          null si le code est illisible ou d'une autre version.
 */
export function decode(code) {
  try {
    const bytes = base64UrlToBytes(code);
    if (!bytes.length || bytes[0] !== CODE_VERSION) return null;
    const owned = new Set();
    const mastered = new Set();
    ALL_SLOTS.forEach((slot, i) => {
      const o = bytes[1 + (i >> 3)];
      const m = bytes[1 + OCTETS + (i >> 3)];
      if (o !== undefined && o & (1 << (i & 7))) owned.add(slot);
      if (m !== undefined && m & (1 << (i & 7))) mastered.add(slot);
    });
    // La maîtrise n'a de sens que sur une case possédée.
    for (const s of [...mastered]) if (!owned.has(s)) mastered.delete(s);
    return { owned, mastered };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------- sauvegarde fichier */

const BACKUP_FORMAT = 'sprite-tracker-backup';

/**
 * Objet de sauvegarde, lisible et ré-importable.
 * `sync` contient l'adresse, le salon et le profil : sans eux, la collection
 * stockée sur le serveur serait irrécupérable en cas de perte de l'appareil.
 */
export function buildBackup(owned, mastered = new Set(), sync = null) {
  return {
    format: BACKUP_FORMAT,
    version: CODE_VERSION,
    exportedAt: new Date().toISOString(),
    count: owned.size,
    masteredCount: mastered.size,
    code: encode(owned, mastered),
    owned: [...owned].sort(),
    mastered: [...mastered].sort(),
    sync: sync ? { url: sync.url, room: sync.room, profile: sync.profile } : null,
  };
}

/**
 * Relit une sauvegarde.
 * @returns {{owned:Set<string>, exportedAt:string}|null} null si le fichier
 *          n'est pas une sauvegarde exploitable.
 */
export function readBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.format !== BACKUP_FORMAT) return null;

  const valide = (s) => typeof s === 'string' && s.includes(':');
  const lireSync = (d) =>
    d.sync && typeof d.sync === 'object' && d.sync.url && d.sync.room
      ? { url: String(d.sync.url), room: String(d.sync.room), profile: String(d.sync.profile || '') }
      : null;

  // La liste explicite prime ; le code sert de secours s'il manque.
  if (Array.isArray(data.owned)) {
    const owned = new Set(data.owned.filter(valide));
    const mastered = new Set(
      (Array.isArray(data.mastered) ? data.mastered : []).filter((s) => valide(s) && owned.has(s))
    );
    return { owned, mastered, sync: lireSync(data), exportedAt: data.exportedAt || '' };
  }
  if (typeof data.code === 'string') {
    const lu = decode(data.code);
    if (lu) return { ...lu, sync: lireSync(data), exportedAt: data.exportedAt || '' };
  }
  return null;
}

export function shareUrl(owned, mastered = new Set()) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('c', encode(owned, mastered));
  return url.toString();
}

/** Lit le code présent dans l'URL, sans le retirer. */
export function readUrlCode() {
  return new URL(window.location.href).searchParams.get('c');
}

/** Retire le paramètre de partage de la barre d'adresse une fois traité. */
export function clearUrlCode() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('c')) return;
  url.searchParams.delete('c');
  history.replaceState(null, '', url.toString());
}
