/*
 * Serveur de synchronisation — Cloudflare Worker + KV.
 *
 * Modèle : un « salon » (room) contient plusieurs profils nommés. Chaque
 * personne synchronise SON profil entre SES appareils, et lit ceux des autres
 * pour comparer les collections. Les profils ne sont jamais fusionnés entre eux.
 *
 * Authentification : une clé partagée par salon, choisie à la création. Elle
 * n'est jamais stockée en clair — seul son SHA-256 l'est. C'est suffisant pour
 * un usage privé entre amis ; ce n'est pas un système de comptes.
 *
 * Routes
 *   GET    /v1/rooms/:room                     -> tous les profils du salon
 *   PUT    /v1/rooms/:room/profiles/:profile   -> enregistre un profil
 *   DELETE /v1/rooms/:room/profiles/:profile   -> supprime un profil
 * Toutes exigent l'en-tête `x-sync-key`.
 */

const MAX_PROFILES = 16;
const MAX_OWNED = 512; // largement au-dessus des 117 cases
const MAX_NAME = 40;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...cors(),
    },
  });

const cors = () => ({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-sync-key',
  'access-control-max-age': '86400',
});

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant, pour ne pas fuiter la clé caractère par caractère. */
function equalConstantTime(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const validId = (s) => typeof s === 'string' && /^[a-z0-9_-]{3,40}$/i.test(s);

/**
 * Vérifie la clé du salon. Crée le salon à la première utilisation : la
 * première clé employée devient celle du salon.
 */
async function authorize(env, room, key) {
  if (!key || key.length < 8) return { ok: false, status: 401, error: 'clé manquante ou trop courte' };

  const metaKey = `room:${room}:meta`;
  const brut = await env.SYNC.get(metaKey);
  const empreinte = await sha256(`${room}:${key}`);

  if (!brut) {
    await env.SYNC.put(metaKey, JSON.stringify({ hash: empreinte, createdAt: Date.now() }));
    return { ok: true, created: true };
  }
  const meta = JSON.parse(brut);
  if (!equalConstantTime(meta.hash, empreinte)) {
    return { ok: false, status: 403, error: 'clé incorrecte pour ce salon' };
  }
  return { ok: true, created: false };
}

async function listProfiles(env, room) {
  const prefix = `room:${room}:profile:`;
  const { keys } = await env.SYNC.list({ prefix });
  const entries = await Promise.all(
    keys.slice(0, MAX_PROFILES).map(async (k) => {
      const v = await env.SYNC.get(k.name);
      return v ? [k.name.slice(prefix.length), JSON.parse(v)] : null;
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    if (!env.SYNC) return json({ error: 'espace KV non lié (binding SYNC)' }, 500);

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // v1, rooms, :room, [profiles, :profile]

    if (parts[0] !== 'v1' || parts[1] !== 'rooms' || !parts[2]) {
      return json({ error: 'route inconnue' }, 404);
    }
    const room = parts[2];
    if (!validId(room)) return json({ error: 'identifiant de salon invalide' }, 400);

    const auth = await authorize(env, room, request.headers.get('x-sync-key'));
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    // GET /v1/rooms/:room
    if (parts.length === 3 && request.method === 'GET') {
      return json({ room, created: auth.created, profiles: await listProfiles(env, room) });
    }

    if (parts[3] !== 'profiles' || !parts[4]) return json({ error: 'route inconnue' }, 404);
    const profile = parts[4];
    if (!validId(profile)) return json({ error: 'identifiant de profil invalide' }, 400);

    const cle = `room:${room}:profile:${profile}`;

    if (request.method === 'DELETE') {
      await env.SYNC.delete(cle);
      return json({ ok: true, deleted: profile });
    }

    if (request.method === 'PUT') {
      let corps;
      try {
        corps = await request.json();
      } catch {
        return json({ error: 'corps JSON invalide' }, 400);
      }

      const owned = Array.isArray(corps.owned)
        ? corps.owned.filter((s) => typeof s === 'string' && /^[a-z0-9]+:[a-z]+$/i.test(s)).slice(0, MAX_OWNED)
        : null;
      if (!owned) return json({ error: 'champ owned manquant ou invalide' }, 400);

      const existant = await env.SYNC.get(cle);
      const precedent = existant ? JSON.parse(existant) : null;

      // Écriture concurrente : on refuse d'écraser une version plus récente.
      const updatedAt = Number(corps.updatedAt) || Date.now();
      if (precedent && precedent.updatedAt > updatedAt) {
        return json({ error: 'version distante plus récente', profile: precedent }, 409);
      }

      const enregistre = {
        name: String(corps.name || profile).slice(0, MAX_NAME),
        owned,
        count: owned.length,
        updatedAt,
        syncedAt: Date.now(),
      };
      await env.SYNC.put(cle, JSON.stringify(enregistre));
      return json({ ok: true, profile: enregistre });
    }

    return json({ error: 'méthode non autorisée' }, 405);
  },
};
