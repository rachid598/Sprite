/*
 * Passerelle privée vers api-fortnite.com. Déploiement séparé du serveur salon.
 * Aucun mot de passe Epic. Les secrets fournisseur et les jetons restent ici.
 */
const UPSTREAM = 'https://prod.api-fortnite.com';
const SESSION_MS = 60 * 60 * 1000;
const response = (data, status = 200, origin = '') => new Response(JSON.stringify(data), {
  status, headers: {
    'content-type': 'application/json', 'cache-control': 'no-store',
    'access-control-allow-origin': origin, 'vary': 'Origin',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'x-content-type-options': 'nosniff',
  },
});

export function epicLoginUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'www.epicgames.com' ||
      url.username || url.password) throw new Error('URL Epic inattendue.');
  return url.href;
}

async function encryptionKey(env) {
  if (!/^[a-f0-9]{64}$/i.test(env.SESSION_ENCRYPTION_KEY || '')) throw new Error('Configuration incomplète.');
  const bytes = Uint8Array.from(env.SESSION_ENCRYPTION_KEY.match(/../g), (s) => parseInt(s, 16));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function save(env, id, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    await encryptionKey(env), new TextEncoder().encode(JSON.stringify(data))
  );
  const encode = (a) => btoa(String.fromCharCode(...new Uint8Array(a)));
  // Pas de TTL KV : le cron doit pouvoir révoquer le device auth après expiration.
  await env.EPIC_SESSIONS.put('epic:' + id, JSON.stringify({ iv: encode(iv), body: encode(body) }));
}
async function load(env, id) {
  const raw = await env.EPIC_SESSIONS.get('epic:' + id);
  if (!raw) return null;
  const { iv, body } = JSON.parse(raw);
  const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(iv), additionalData: new TextEncoder().encode(id) },
    await encryptionKey(env), bytes(body)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
async function upstream(env, path, { method = 'GET', body, token } = {}) {
  const headers = { 'x-api-key': env.FORTNITE_API_KEY };
  if (token) headers['x-fortnite-token'] = token;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(UPSTREAM + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  const data = await res.json();
  return { status: res.status, data };
}
async function remove(env, id, session) {
  if (session.deviceAuth) {
    const result = await upstream(env, '/api/v1/oauth/revoke-device', {
      method: 'POST', body: session.deviceAuth,
    });
    // Déjà révoqué : le fournisseur documente 400.
    if (![200, 400].includes(result.status)) return false;
  }
  await env.EPIC_SESSIONS.delete('epic:' + id);
  return true;
}
const bearer = (request) => {
  const id = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  return id || '';
};
const randomId = () => [...crypto.getRandomValues(new Uint8Array(32))]
  .map((n) => n.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return response({ error: 'Origine refusée.' }, 403);
    const reply = (data, status = 200) => response(data, status, origin);
    if (request.method === 'OPTIONS') return reply({});
    const path = new URL(request.url).pathname;
    const configured = !!(env.FORTNITE_API_KEY && env.EPIC_SESSIONS &&
      /^[a-f0-9]{64}$/i.test(env.SESSION_ENCRYPTION_KEY || ''));
    if (path === '/status' && request.method === 'GET') return reply({ configured });
    if (!configured) return reply({ error: 'Connexion Epic pas encore configurée.' }, 503);
    try {
      if (path === '/session' && request.method === 'POST') {
        // Plafond global horaire : protège la clé fournisseur contre l'épuisement.
        const bucket = 'rate:' + Math.floor(Date.now() / SESSION_MS);
        const count = Number(await env.EPIC_SESSIONS.get(bucket)) || 0;
        if (count >= 20) return reply({ error: 'Trop de connexions. Réessayez plus tard.' }, 429);
        await env.EPIC_SESSIONS.put(bucket, String(count + 1), { expirationTtl: 7200 });
        const result = await upstream(env, '/api/v1/oauth/get-token');
        if (result.status !== 200) return reply({ error: 'Le fournisseur refuse la connexion. Vérifiez son abonnement.' }, 502);
        // La forme OAuth n'est pas décrite par un schéma OpenAPI : fail closed.
        const flowId = result.data.flowId;
        const url = epicLoginUrl(result.data.verificationUriComplete || result.data.verificationUrl || result.data.url);
        if (typeof flowId !== 'string' || !flowId) throw new Error('Réponse OAuth inattendue.');
        const id = randomId();
        await save(env, id, { flowId, expiresAt: Date.now() + 10 * 60 * 1000, nextPoll: Date.now() + 5000 });
        return reply({ session: id, url, interval: 5 });
      }
      const id = bearer(request);
      if (!id) return reply({ error: 'Connexion requise.' }, 401);
      const session = await load(env, id);
      if (!session) return reply({ error: 'Session expirée. Reconnectez-vous.' }, 401);
      if (path === '/session' && request.method === 'DELETE') {
        if (!await remove(env, id, session)) return reply({ error: 'Révocation indisponible. Réessayez.' }, 502);
        return reply({ disconnected: true });
      }
      if (session.expiresAt <= Date.now()) {
        await remove(env, id, session);
        return reply({ error: 'Session expirée. Reconnectez-vous.' }, 401);
      }
      if (path === '/session/complete' && request.method === 'POST') {
        if (session.token) return reply({ connected: true });
        if (Date.now() < session.nextPoll) return reply({ pending: true }, 202);
        session.nextPoll = Date.now() + 5000;
        await save(env, id, session);
        const result = await upstream(env, '/api/v1/oauth/complete', {
          method: 'POST', body: { flowId: session.flowId },
        });
        if ([202, 429].includes(result.status)) return reply({ pending: true }, 202);
        if (result.status !== 200) return reply({ error: 'Connexion Epic refusée ou expirée.' }, 401);
        const data = result.data;
        const token = data.accessToken || data.access_token;
        if (typeof token !== 'string' || !token) throw new Error('Réponse OAuth inattendue.');
        const deviceAuth = data.deviceAuth;
        if (deviceAuth && !['accountId', 'deviceId', 'secret'].every((k) => typeof deviceAuth[k] === 'string' && deviceAuth[k])) {
          throw new Error('Réponse OAuth inattendue.');
        }
        // Une déconnexion survenue pendant l'appel fournisseur ne doit pas
        // recréer une session ni laisser une autorisation de connexion active.
        if (!await load(env, id)) {
          if (deviceAuth) await remove(env, id, { deviceAuth });
          return reply({ error: 'Connexion annulée.' }, 401);
        }
        await save(env, id, { token, deviceAuth, expiresAt: Date.now() + SESSION_MS });
        return reply({ connected: true });
      }
      if (path === '/collection' && request.method === 'GET') {
        if (!session.token) return reply({ error: 'Connexion Epic en attente.' }, 409);
        const season = new URL(request.url).searchParams.get('season');
        const major = { s3: 41, s4: 42 }[season];
        if (!major) return reply({ error: 'Saison inconnue.' }, 400);
        const catalogs = await upstream(env, '/api/v2/sprites/versions');
        if (catalogs.status !== 200 || !Array.isArray(catalogs.data)) throw new Error('Catalogues indisponibles.');
        const versions = catalogs.data.map((c) => c.version)
          .filter((v) => typeof v === 'string' && /^\d+\.\d+$/.test(v) && Number(v.split('.')[0]) === major)
          .sort((a, b) => Number(b) - Number(a));
        const version = versions[0];
        if (!version) return reply({ error: 'Aucun catalogue disponible pour cette saison.' }, 502);
        const result = await upstream(env, '/api/v2/sprites/collection?version=' + version, { token: session.token });
        if (result.status !== 200) return reply({
          error: result.status === 401 ? 'Session Epic expirée. Reconnectez-vous.' : 'Collection indisponible chez le fournisseur.',
        }, result.status === 401 ? 401 : 502);
        // Seules les données de collection nécessaires quittent la passerelle.
        const { gameVersion, sprites } = result.data;
        if (typeof gameVersion !== 'string' || !Array.isArray(sprites)) throw new Error('Format de collection inattendu.');
        return reply({ gameVersion, sprites: sprites.map((s) => ({
          id: s.id, name: s.name, variants: s.variants?.map((v) => ({
            variant: v.variant, owned: v.owned, mastered: v.mastered,
          })),
        })) });
      }
      return reply({ error: 'Route inconnue.' }, 404);
    } catch {
      // Ne jamais renvoyer ni journaliser une réponse fournisseur / un jeton.
      return reply({ error: 'Passerelle Epic indisponible ou réponse fournisseur non reconnue.' }, 502);
    }
  },
  async scheduled(event, env) {
    // Révocation des autorisations de connexion expirées, y compris après fermeture de l'onglet.
    let cursor;
    do {
      const page = await env.EPIC_SESSIONS.list({ prefix: 'epic:', cursor });
      for (const item of page.keys) {
        const id = item.name.slice(5);
        try {
          const session = await load(env, id);
          if (session && session.expiresAt <= Date.now()) await remove(env, id, session);
        } catch { /* conserver pour réessayer au prochain passage */ }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  },
};
