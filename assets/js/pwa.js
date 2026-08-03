/*
 * Application installable et fonctionnement hors ligne.
 *
 * Le service worker vit à la racine du site (../sw.js depuis /fr/) : sa portée
 * couvre donc la page et tous les assets partagés.
 */

const SW_URL = new URL('../../sw.js', import.meta.url);
const SCOPE = new URL('../../', import.meta.url);

/**
 * Enregistre le service worker.
 * @param {(reg: ServiceWorkerRegistration) => void} onUpdate appelé quand une
 *        nouvelle version est prête à remplacer celle en cours.
 */
export async function registerServiceWorker(onUpdate) {
  if (!('serviceWorker' in navigator)) return null;
  // Le protocole file:// n'autorise pas les service workers.
  if (!['https:', 'http:'].includes(location.protocol)) return null;

  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // « installed » avec un contrôleur déjà actif = mise à jour en attente.
        if (sw.state === 'installed' && navigator.serviceWorker.controller) onUpdate?.(reg);
      });
    });

    return reg;
  } catch {
    return null; // navigation privée, ou service workers désactivés
  }
}

/** Active la version en attente et recharge la page. */
export function applyUpdate(reg) {
  reg?.waiting?.postMessage('skip-waiting');
  let rechargee = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargee) return;
    rechargee = true;
    location.reload();
  });
}

/**
 * Suit la possibilité d'installer l'application.
 * @param {(installable: boolean) => void} onChange
 * @returns {() => Promise<void>} déclenche l'invite d'installation
 */
export function trackInstall(onChange) {
  let invite = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // on décide nous-mêmes du moment
    invite = e;
    onChange(true);
  });

  window.addEventListener('appinstalled', () => {
    invite = null;
    onChange(false);
  });

  return async () => {
    if (!invite) return;
    invite.prompt();
    await invite.userChoice;
    invite = null;
    onChange(false);
  };
}

/** true quand la page tourne dans la fenêtre de l'application installée. */
export const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/**
 * iOS et iPadOS ne connaissent pas `beforeinstallprompt` : l'installation y est
 * forcément manuelle, il faut donc expliquer la marche à suivre plutôt que
 * d'attendre une invite qui ne viendra jamais.
 *
 * L'iPad récent s'annonce comme un Mac : on le reconnaît à son écran tactile.
 */
export const estIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
