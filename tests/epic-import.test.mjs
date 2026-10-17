import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEpicCollection, mergeEpicCollection } from '../assets/js/epic-import.js';
import { SAISONS } from '../assets/js/data.js';
import { getStrings } from '../assets/js/i18n.js';
import worker, { epicLoginUrl } from '../server/epic-worker.js';
import { bindEpicImport } from '../assets/js/epic-ui.js';

const payload = (name, variants, gameVersion = '42.30') => ({
  gameVersion, sprites: [{ name, variants }],
});
const variant = (id, owned = true, mastered = false) => ({ variant: id, owned, mastered });

test('les 279 cases publiées sont reconnues sans modifier le registre des saisons', () => {
  const before = JSON.stringify(SAISONS), names = getStrings().name;
  for (const season of SAISONS) {
    const p = {
      gameVersion: season.id === 's3' ? '41.30' : '42.30',
      sprites: season.sprites.map((s) => ({
        name: names[s.id], variants: s.variants.map((v) => variant(v, true, true)),
      })),
    };
    const result = parseEpicCollection(p, season.id);
    assert.equal(result.owned.size, season.id === 's3' ? 117 : 162);
    assert.equal(result.mastered.size, result.owned.size);
    assert.equal(result.unknown.length, 0);
  }
  assert.equal(JSON.stringify(SAISONS), before);
});
test('noms anglais et français, variantes et maîtrise explicite', () => {
  const result = parseEpicCollection(payload('One Wish Willow Sprite', [
    variant('Base', true, true), variant('Cheat Master'), variant('Gold', false, true),
  ]), 's4');
  assert.deepEqual([...result.owned], ['onewishwillow:normal', 'onewishwillow:cheatmaster']);
  assert.deepEqual([...result.mastered], ['onewishwillow:normal']);
  const s3 = parseEpicCollection(payload('Grim Reaper', [variant('Holofoil')], '41.30'), 's3');
  assert.ok(s3.owned.has('reaper:holofoil'));
});
test('aucune maîtrise déduite arbitrairement de l’XP', () => {
  const result = parseEpicCollection(payload('Sonic', [{ ...variant('Base'), mastered: null, xp: 999999 }]), 's4');
  assert.equal(result.mastered.size, 0);
});
test('variante inconnue ignorée avec signalement, sans substitution', () => {
  const result = parseEpicCollection(payload('Sonic', [variant('Mystery'), variant('Base')]), 's4');
  assert.deepEqual([...result.owned], ['sonic:normal']);
  assert.equal(result.unknown.length, 1);
});
test('données mal formées et saisons incompatibles refusées', () => {
  for (const data of [null, {}, { sprites: [] }, payload('Sonic', null),
    payload('Sonic', [{ variant: 'Base', owned: 'false' }]),
    payload('Sonic', [{ variant: 'Base', owned: true, mastered: 'yes' }])]) {
    assert.throws(() => parseEpicCollection(data, 's4'));
  }
  assert.throws(() => parseEpicCollection(payload('Sonic', [], '41.30'), 's4'));
  assert.throws(() => parseEpicCollection(payload('Sonic', [], '43.00'), 's4'));
});
test('fusion additive : aucune perte de possession, maîtrise ou donnée d’entrée', () => {
  const current = { owned: new Set(['bush:gold']), mastered: new Set(['bush:gold']) };
  const incoming = parseEpicCollection(payload('Sonic', [variant('Base', true, true)]), 's4');
  const result = mergeEpicCollection(current, incoming);
  assert.deepEqual([...result.owned], ['bush:gold', 'sonic:normal']);
  assert.deepEqual([...result.mastered], ['bush:gold', 'sonic:normal']);
  assert.deepEqual([...current.owned], ['bush:gold']);
  assert.deepEqual(mergeEpicCollection(current, { owned: new Set(), mastered: new Set() }), current);
});
test('la connexion est exclusivement ouverte sur le domaine Epic attendu', () => {
  assert.equal(epicLoginUrl('https://www.epicgames.com/activate'), 'https://www.epicgames.com/activate');
  for (const url of ['javascript:alert(1)', 'http://www.epicgames.com/activate',
    'https://www.epicgames.com.evil.test/', 'https://user@www.epicgames.com/']) {
    assert.throws(() => epicLoginUrl(url));
  }
});
test('passerelle non configurée et origine étrangère : aucun appel fournisseur', async () => {
  const env = { ALLOWED_ORIGIN: 'https://rachid598.github.io' };
  const foreign = await worker.fetch(new Request('https://bridge.test/status', {
    headers: { origin: 'https://evil.test' },
  }), env);
  assert.equal(foreign.status, 403);
  const good = await worker.fetch(new Request('https://bridge.test/status', {
    headers: { origin: env.ALLOWED_ORIGIN },
  }), env);
  assert.deepEqual(await good.json(), { configured: false });
  const start = await worker.fetch(new Request('https://bridge.test/session', {
    method: 'POST', headers: { origin: env.ALLOWED_ORIGIN },
  }), env);
  assert.equal(start.status, 503);
});
test('parcours simulé : OAuth, chiffrement, catalogues, filtrage, révocation', async () => {
  const kv = new Map(), calls = [];
  const env = {
    ALLOWED_ORIGIN: 'https://rachid598.github.io', FORTNITE_API_KEY: 'fixture-api-key',
    SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
    EPIC_SESSIONS: {
      get: async (key) => kv.get(key) || null,
      put: async (key, value) => kv.set(key, value),
      delete: async (key) => kv.delete(key),
      list: async () => ({ keys: [...kv.keys()].filter((key) => key.startsWith('epic:')).map((name) => ({ name })), list_complete: true }),
    },
  };
  const realFetch = globalThis.fetch;
  // Fixtures représentatives : le schéma OAuth réel reste à valider avec une clé Pro.
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers['x-api-key'], 'fixture-api-key');
    let data;
    if (url.endsWith('/get-token')) data = { flowId: 'fixture-flow', url: 'https://www.epicgames.com/activate' };
    else if (url.endsWith('/complete')) data = { accessToken: 'fixture-epic-token',
      deviceAuth: { accountId: 'fixture-account', deviceId: 'fixture-device', secret: 'fixture-secret' } };
    else if (url.endsWith('/versions')) data = [{ version: '43.00' }, { version: '42.30' }, { version: '42.00' }];
    else if (url.includes('/collection?')) {
      assert.equal(options.headers['x-fortnite-token'], 'fixture-epic-token');
      assert.ok(url.endsWith('version=42.30'));
      data = { ...payload('Sonic', [variant('Base', true, true)]), accountId: 'private-account-id' };
    } else if (url.endsWith('/revoke-device')) data = {};
    else throw new Error('Route imprévue : ' + url);
    return Response.json(data);
  };
  const call = (path, method = 'GET', session) => worker.fetch(new Request('https://bridge.test' + path, {
    method, headers: { origin: env.ALLOWED_ORIGIN, ...(session ? { authorization: 'Bearer ' + session } : {}) },
  }), env);
  const realNow = Date.now;
  try {
    const start = await (await call('/session', 'POST')).json();
    assert.match(start.session, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify([...kv.values()]).includes('fixture-flow'), false);
    const pending = await call('/session/complete', 'POST', start.session);
    assert.equal(pending.status, 202);
    Date.now = () => realNow() + 6000;
    const connected = await (await call('/session/complete', 'POST', start.session)).json();
    assert.deepEqual(connected, { connected: true });
    assert.equal(JSON.stringify([...kv.values()]).includes('fixture-epic-token'), false);
    assert.equal(JSON.stringify([...kv.values()]).includes('fixture-secret'), false);
    const collectionResponse = await call('/collection?season=s4', 'GET', start.session);
    const collection = await collectionResponse.json();
    assert.equal(collection.accountId, undefined);
    assert.equal(collectionResponse.headers.get('cache-control'), 'no-store');
    assert.equal(parseEpicCollection(collection, 's4').mastered.size, 1);
    const disconnected = await call('/session', 'DELETE', start.session);
    assert.equal(disconnected.status, 200);
    assert.ok(calls.some((c) => c.url.endsWith('/revoke-device')));
    assert.equal((await call('/collection?season=s4', 'GET', start.session)).status, 401);
    const second = await (await call('/session', 'POST')).json();
    Date.now = () => realNow() + 12000;
    assert.equal((await call('/session/complete', 'POST', second.session)).status, 200);
    Date.now = () => realNow() + 2 * 60 * 60 * 1000;
    await worker.scheduled({}, env);
    assert.equal(kv.has('epic:' + second.session), false);
    assert.equal(calls.filter((c) => c.url.endsWith('/revoke-device')).length, 2);
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
  }
});

test('interface : aperçu, verrou, fusion et invalidation au changement de saison', async () => {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, disabled: false, textContent: '', handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
    });
    return elements.get(id);
  };
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: get };
  let season = 's4', locked = false;
  let current = { owned: new Set(['bush:gold']), mastered: new Set(['bush:gold']) };
  let merges = 0;
  const file = (data) => ({ target: { files: [{ size: 100, text: async () => JSON.stringify(data) }], value: 'file' } });
  try {
    const ui = bindEpicImport({
      getSeason: () => season, getCollection: () => current,
      isLocked: () => locked,
      merge: (incoming) => { current = mergeEpicCollection(current, incoming); merges++; },
    });
    assert.equal(get('epic-connect').disabled, true);
    await get('epic-file').handlers.change(file(payload('Sonic', [variant('Base', true, true)])));
    assert.equal(get('epic-preview').hidden, false);
    assert.equal(get('epic-apply').disabled, false);
    assert.match(get('epic-summary').textContent, /1 nouvelles cases/);
    locked = true;
    get('epic-apply').handlers.click();
    assert.equal(merges, 0);
    locked = false;
    get('epic-apply').handlers.click();
    assert.equal(merges, 1);
    assert.ok(current.owned.has('bush:gold'));
    assert.ok(current.mastered.has('sonic:normal'));
    await get('epic-file').handlers.change(file(payload('Sonic', [variant('Gold')])));
    ui.seasonChanged();
    season = 's3';
    get('epic-apply').handlers.click();
    assert.equal(merges, 1);
    assert.equal(get('epic-preview').hidden, true);
    await get('epic-file').handlers.change(file(payload('Sonic', [variant('Base')])));
    assert.match(get('epic-status').textContent, /autre saison/);
    assert.equal(get('epic-apply').disabled, true);
  } finally { globalThis.document = previousDocument; }
});
