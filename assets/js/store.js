/*
 * Persistance locale + encodage du code de partage.
 *
 * Le code de partage est un champ de bits sur ALL_SLOTS (ordre stable défini
 * dans data.js), préfixé d'un octet de version, encodé en base64url. Ajouter un
 * Sprite en fin de liste reste compatible avec les anciens codes ; réordonner
 * ALL_SLOTS ne l'est pas — d'où l'octet de version.
 */

import { ALL_SLOTS } from './data.js';

const KEY = 'sprite-tracker:v2';
// v2 : la liste des Sprites a été corrigée (24 Sprites, 109 cases) et certains
// identifiants ont changé, donc l'ordre des bits diffère de la v1.
const CODE_VERSION = 2;

/** @returns {{owned:Set<string>, updatedAt:number}} */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { owned: new Set(), updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      owned: new Set(Array.isArray(parsed.owned) ? parsed.owned : []),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return { owned: new Set(), updatedAt: 0 };
  }
}

export function save(owned) {
  const payload = { owned: [...owned], updatedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* mode privé ou quota plein : la session reste utilisable en mémoire */
  }
  return payload.updatedAt;
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

export function encode(owned) {
  const bits = new Uint8Array(1 + Math.ceil(ALL_SLOTS.length / 8));
  bits[0] = CODE_VERSION;
  ALL_SLOTS.forEach((slot, i) => {
    if (owned.has(slot)) bits[1 + (i >> 3)] |= 1 << (i & 7);
  });
  return bytesToBase64Url(bits);
}

/** @returns {Set<string>|null} null si le code est illisible ou d'une autre version. */
export function decode(code) {
  try {
    const bytes = base64UrlToBytes(code);
    if (!bytes.length || bytes[0] !== CODE_VERSION) return null;
    const owned = new Set();
    ALL_SLOTS.forEach((slot, i) => {
      const byte = bytes[1 + (i >> 3)];
      if (byte !== undefined && byte & (1 << (i & 7))) owned.add(slot);
    });
    return owned;
  } catch {
    return null;
  }
}

export function shareUrl(owned) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('c', encode(owned));
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
