/*
 * Synchronisation via Firebase Realtime Database.
 *
 * On utilise l'API REST de Firebase : une simple requête HTTP sur
 * <base>/rooms/<salon>/profiles/<profil>.json. Aucune bibliothèque à charger,
 * aucun outil à installer — juste l'adresse de la base, copiée depuis la
 * console Firebase.
 *
 * Modèle : un salon contient plusieurs profils nommés. Chacun synchronise SON
 * profil entre SES appareils et lit ceux des autres pour comparer. Les profils
 * ne sont jamais fusionnés entre eux.
 *
 * Le nom du salon fait office de secret partagé : il est long et aléatoire, et
 * les règles de sécurité conseillées en exigent la longueur. Qui ne le connaît
 * pas ne peut pas deviner le chemin.
 */

import { SAISON } from './data.js';

const CONFIG_KEY = 'sprite-tracker:sync';

/** @typedef {{url:string, room:string, profile:string}} Config */

export function loadConfig() {
  try {
    const brut = localStorage.getItem(CONFIG_KEY);
    if (!brut) return null;
    const c = JSON.parse(brut);
    return c && c.url && c.room && c.profile ? c : null;
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* stockage indisponible : la configuration vaut pour la session */
  }
}

export function clearConfig() {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* rien à faire */
  }
}

/*
 * Mémoire durable des réglages déjà utilisés.
 *
 * Séparée de la configuration active et jamais effacée automatiquement : se
 * déconnecter, ou perdre la configuration, ne doit pas condamner l'accès au
 * salon. Sans le code, la collection stockée sur Firebase serait irrécupérable.
 */
const DERNIERS_KEY = 'sprite-tracker:sync-last';

export function rememberConfig(config) {
  try {
    localStorage.setItem(
      DERNIERS_KEY,
      JSON.stringify({ url: config.url, room: config.room, profile: config.profile })
    );
  } catch {
    /* stockage indisponible */
  }
}

/** @returns {{url:string, room:string, profile:string}|null} */
export function loadLastConfig() {
  try {
    const brut = localStorage.getItem(DERNIERS_KEY);
    if (!brut) return null;
    const c = JSON.parse(brut);
    return c && (c.url || c.room) ? c : null;
  } catch {
    return null;
  }
}

/** Nom de salon aléatoire : c'est lui qui protège l'accès, il doit être long. */
export function randomRoom() {
  const mots = 'abcdefghijkmnpqrstuvwxyz23456789';
  const octets = crypto.getRandomValues(new Uint8Array(20));
  return [...octets].map((b) => mots[b % mots.length]).join('');
}

/**
 * Normalise l'adresse copiée depuis Firebase : on tolère une barre finale,
 * un `/` de trop ou un `.json` collé par erreur.
 */
export function normalizeUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\.json.*$/i, '')
    .replace(/\/+$/, '');
}

export function isValidUrl(url) {
  const u = normalizeUrl(url);
  // Adresse Firebase, ou serveur local pour le développement et les tests.
  return (
    /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebasedatabase\.app|firebaseio\.com)$/i.test(u) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)
  );
}

/*
 * Chaque saison a sa propre branche sur le serveur.
 *
 * La Saison 3 garde le chemin historique `/profiles/…`, sans quoi un appareil
 * resté en ancienne version cesserait de se synchroniser. Les saisons suivantes
 * vivent sous `/saisons/<id>/profiles/…` : un client ancien ne les voit pas, et
 * ne peut donc pas les écraser.
 */
const racineSaison = () => (SAISON.id === 's3' ? '' : `/saisons/${SAISON.id}`);

const chemin = (config, suite = '') =>
  `${normalizeUrl(config.url)}/rooms/${encodeURIComponent(config.room)}${suite}.json`;

async function requete(url, options = {}) {
  const reponse = await fetch(url, options);
  const texte = await reponse.text();

  if (!reponse.ok) {
    // Firebase renvoie {"error":"Permission denied"} quand les règles bloquent.
    let message = `erreur ${reponse.status}`;
    try {
      message = JSON.parse(texte).error || message;
    } catch {
      /* réponse non JSON : on garde le code */
    }
    const err = new Error(message);
    err.status = reponse.status;
    throw err;
  }
  return texte ? JSON.parse(texte) : null;
}

/**
 * Tous les profils du salon.
 * @returns {Promise<Record<string, {name:string, owned:string[], mastered:string[], count:number, updatedAt:number}>>}
 */
export async function pull(config) {
  const data = await requete(chemin(config, `${racineSaison()}/profiles`));
  if (!data || typeof data !== 'object') return {};

  // On assainit : le contenu vient du réseau, il peut être partiel ou modifié.
  const propre = {};
  for (const [id, p] of Object.entries(data)) {
    if (!p || typeof p !== 'object') continue;
    const owned = Array.isArray(p.owned) ? p.owned.filter((s) => typeof s === 'string') : [];
    const mastered = Array.isArray(p.mastered)
      ? p.mastered.filter((s) => typeof s === 'string' && owned.includes(s))
      : [];
    propre[id] = {
      name: typeof p.name === 'string' ? p.name.slice(0, 40) : id,
      owned,
      mastered,
      codes: Array.isArray(p.codes) ? p.codes.filter((c) => typeof c === 'string') : [],
      count: owned.length,
      updatedAt: Number(p.updatedAt) || 0,
    };
  }
  return propre;
}

/** Envoie la collection locale sous notre profil. */
export async function push(config, owned, mastered, updatedAt, codes = new Set()) {
  const corps = {
    name: config.profile,
    owned: [...owned],
    mastered: [...mastered].filter((s) => owned.has(s)),
    codes: [...codes],
    count: owned.size,
    updatedAt: updatedAt || Date.now(),
  };
  await requete(chemin(config, `${racineSaison()}/profiles/${encodeURIComponent(config.profile)}`), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
  return corps;
}

/** Vérifie que l'adresse répond et que les règles autorisent la lecture. */
export async function testConnection(config) {
  const profils = await pull(config);
  return { ok: true, profils: Object.keys(profils).length };
}

/**
 * Regroupe les envois rapprochés : cocher dix cases ne déclenche qu'une écriture.
 * @param {() => void} action
 * @param {number} delai millisecondes
 */
export function debounce(action, delai = 2500) {
  let timer;
  const differe = () => {
    clearTimeout(timer);
    timer = setTimeout(action, delai);
  };
  differe.flush = () => {
    clearTimeout(timer);
    action();
  };
  differe.cancel = () => clearTimeout(timer);
  return differe;
}