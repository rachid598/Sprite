import { EPIC_BRIDGE_URL } from './epic-config.js';
import { parseEpicCollection } from './epic-import.js';

export function bindEpicImport({ getSeason, getCollection, merge, isLocked }) {
  const el = (id) => document.getElementById('epic-' + id);
  const message = (text) => { el('status').textContent = text; };
  let session = '', timer, pending, generation = 0, busy = false;
  const clearPreview = () => {
    generation++;
    pending = null;
    el('preview').hidden = true;
    el('apply').disabled = true;
  };
  const bridge = EPIC_BRIDGE_URL.replace(/\/$/, '');
  const validBridge = (() => {
    if (!bridge) return false;
    try {
      const u = new URL(bridge);
      return !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash &&
        (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname)));
    } catch { return false; }
  })();
  async function request(path, method = 'GET') {
    const res = await fetch(bridge + path, {
      method, headers: session ? { authorization: 'Bearer ' + session } : {},
      cache: 'no-store', credentials: 'omit', redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Connexion indisponible.');
    return data;
  }
  function preview(payload, season, epoch) {
    if (getSeason() !== season || epoch !== generation) return;
    pending = parseEpicCollection(payload, season);
    const current = getCollection();
    const added = [...pending.owned].filter((s) => !current.owned.has(s)).length;
    const mastered = [...pending.mastered].filter((s) => !current.mastered.has(s)).length;
    el('summary').textContent = 'Saison ' + season.slice(1) + ' : ' +
      pending.owned.size + ' obtenus, ' + pending.mastered.size + ' maîtrisés. ' +
      added + ' nouvelles cases et ' + mastered + ' nouvelles maîtrises à ajouter.' +
      (pending.unknown.length ? ' ' + pending.unknown.length + ' variantes non reconnues seront ignorées.' : '');
    el('preview').hidden = false;
    el('apply').disabled = pending.owned.size === 0;
    message('Collection prête à vérifier. Votre progression actuelle sera conservée.');
  }
  async function readCollection() {
    clearPreview();
    const season = getSeason(), epoch = generation;
    const data = await request('/collection?season=' + encodeURIComponent(season));
    preview(data, season, epoch);
  }
  function signedOut() {
    clearTimeout(timer);
    session = '';
    el('link').hidden = true;
    el('refresh').disabled = true;
    el('disconnect').disabled = true;
    el('connect').disabled = !validBridge;
  }
  async function poll() {
    if (!session) return;
    busy = true;
    try {
      const data = await request('/session/complete', 'POST');
      if (!session) return;
      if (data.pending) { timer = setTimeout(poll, 5000); return; }
      if (data.connected !== true) throw new Error('Réponse de connexion inattendue.');
      el('link').hidden = true;
      el('refresh').disabled = false;
      message('Compte connecté pour cette session. Lecture de la collection…');
      await readCollection();
    } catch (err) {
      // Garder la possibilité de révoquer le compte si la lecture a échoué.
      message(err.message || 'Connexion interrompue.');
    } finally { busy = false; }
  }
  el('connect').addEventListener('click', async () => {
    if (busy || session) return;
    busy = true;
    el('connect').disabled = true;
    try {
      message('Préparation de la connexion…');
      const data = await request('/session', 'POST');
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'www.epicgames.com' ||
          url.username || url.password || !/^[a-f0-9]{64}$/.test(data.session)) {
        throw new Error('Réponse de connexion non reconnue.');
      }
      session = data.session; // mémoire de cet onglet uniquement
      el('link').href = url.href;
      el('link').hidden = false;
      el('disconnect').disabled = false;
      message('Ouvrez Epic Games et autorisez la connexion. Revenez ensuite sur cet onglet.');
      timer = setTimeout(poll, 5000);
    } catch (err) {
      message(err.message || 'Connexion impossible.');
      signedOut();
    } finally { busy = false; }
  });
  el('refresh').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try { await readCollection(); } catch (err) { message(err.message); }
    finally { busy = false; }
  });
  el('disconnect').addEventListener('click', async () => {
    if (busy || !session) return;
    busy = true;
    clearTimeout(timer);
    clearPreview();
    try {
      await request('/session', 'DELETE');
      signedOut();
      message('Compte déconnecté. Votre collection est conservée.');
    } catch (err) { message(err.message + ' Vous pouvez réessayer de déconnecter le compte.'); }
    finally { busy = false; }
  });
  el('file').addEventListener('change', async (event) => {
    clearPreview();
    const file = event.target.files[0], season = getSeason(), epoch = generation;
    try {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) throw new Error('Fichier trop volumineux (2 Mo maximum).');
      preview(JSON.parse(await file.text()), season, epoch);
    } catch (err) { message(err.message || 'Fichier de collection invalide.'); }
    finally { event.target.value = ''; }
  });
  el('apply').addEventListener('click', () => {
    if (isLocked()) return message('Déverrouillez la collection avant de la modifier.');
    if (!pending || pending.seasonId !== getSeason()) return clearPreview();
    merge(pending);
    clearPreview();
    message('Import terminé. Les anciennes possessions et maîtrises sont conservées.');
  });
  signedOut();
  if (validBridge) {
    request('/status').then((data) => {
      if (data.configured !== true) {
        el('connect').disabled = true;
        message('Connexion Epic en préparation. L’import de fichier reste disponible.');
      } else message('Connexion disponible. Lisez les conditions ci-dessous avant de continuer.');
    }).catch(() => {
      el('connect').disabled = true;
      message('Serveur Epic indisponible. L’import de fichier reste disponible.');
    });
  } else message('Connexion Epic en préparation. L’import de fichier reste disponible.');
  return { seasonChanged: clearPreview };
}
