/*
 * Client de synchronisation.
 *
 * Parle au Worker de server/worker.js. Un salon contient plusieurs profils
 * nommés : on n'envoie et ne reçoit que le sien, on lit ceux des autres pour
 * comparer les collections.
 *
 * La configuration (adresse, salon, clé, profil) reste dans ce navigateur.
 */

const CONFIG_KEY = 'sprite-tracker:sync';

/** @typedef {{url:string, room:string, key:string, profile:string, name:string}} Config */

export function loadConfig() {
  try {
    const brut = localStorage.getItem(CONFIG_KEY);
    if (!brut) return null;
    const c = JSON.parse(brut);
    return c && c.url && c.room && c.key && c.profile ? c : null;
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

/** Retire le / final pour éviter les doubles barres dans les URL construites. */
const base = (config) => config.url.replace(/\/+$/, '');

async function request(config, chemin, options = {}) {
  const reponse = await fetch(base(config) + chemin, {
    ...options,
    headers: { 'x-sync-key': config.key, ...(options.headers || {}) },
  });

  let corps = null;
  try {
    corps = await reponse.json();
  } catch {
    /* réponse sans JSON exploitable */
  }

  if (!reponse.ok) {
    const err = new Error(corps?.error || `erreur ${reponse.status}`);
    err.status = reponse.status;
    err.body = corps;
    throw err;
  }
  return corps;
}

/** Tous les profils du salon. @returns {Promise<Record<string, object>>} */
export async function pull(config) {
  const data = await request(config, `/v1/rooms/${encodeURIComponent(config.room)}`);
  return data.profiles || {};
}

/**
 * Envoie la collection locale.
 * @throws une erreur `status === 409` si la version distante est plus récente ;
 *         son `body.profile` contient alors la version distante.
 */
export async function push(config, owned, updatedAt) {
  const data = await request(
    config,
    `/v1/rooms/${encodeURIComponent(config.room)}/profiles/${encodeURIComponent(config.profile)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: config.name || config.profile,
        owned: [...owned],
        updatedAt,
      }),
    }
  );
  return data.profile;
}

/** Vérifie que l'adresse et la clé répondent, sans rien modifier. */
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
