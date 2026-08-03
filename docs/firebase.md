# Synchroniser avec Firebase

Tout se fait dans le navigateur. Aucun logiciel à installer, aucune commande à
taper. Comptez cinq minutes, une seule fois.

À la fin, vous aurez une adresse à coller dans le site. C'est tout.

---

## 1. Créer le projet

1. Aller sur <https://console.firebase.google.com>
2. Se connecter avec un compte Google
3. Cliquer **Créer un projet**
4. Nom du projet : `sprite-tracker` (ou ce que vous voulez)
5. **Décocher** Google Analytics — inutile ici
6. Cliquer **Créer le projet**, puis attendre et cliquer **Continuer**

## 2. Créer la base

1. Menu de gauche : **Créer** → **Realtime Database**

   Attention : bien choisir *Realtime Database*, pas *Firestore*. Ce sont deux
   produits différents et le site utilise le premier.

2. Cliquer **Créer une base de données**
3. Emplacement : **Belgium (europe-west1)** si vous êtes en Europe
4. Mode de sécurité : garder **Commencer en mode verrouillé** — celui déjà
   coché — puis **Activer**

   Ne prenez pas *mode test* : il ouvre la base à tout le monde pendant 30 jours
   puis la referme, et la synchro tomberait en panne du jour au lendemain. Comme
   on écrit nos propres règles à l'étape 4, partir verrouillé est plus sûr et ne
   demande aucun travail en plus.

   Tant que l'étape 4 n'est pas faite, le site affichera « Accès refusé par
   Firebase ». C'est normal.

## 3. Copier l'adresse

En haut de la page de la base s'affiche une adresse de cette forme :

```
https://sprite-tracker-default-rtdb.europe-west1.firebasedatabase.app
```

**C'est elle qu'il faut copier.** Gardez-la sous la main.

## 4. Régler les autorisations

En mode verrouillé, la base refuse tout. Cette étape est donc celle qui rend la
synchronisation possible : sans elle, rien ne fonctionnera.

1. Onglet **Règles**, en haut de la page de la base
2. Effacer ce qui s'y trouve et coller exactement ceci :

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "$room.length >= 12",
        ".write": "$room.length >= 12"
      }
    }
  }
}
```

3. Cliquer **Publier**

Cette règle n'autorise l'accès qu'aux salons dont le code fait au moins 12
caractères. Le code généré par le site en fait 20, tirés au hasard : personne ne
peut le deviner, et personne ne peut lister les salons existants.

## 5. Brancher le site

Sur <https://rachid598.github.io/Sprite/fr/>, section **Synchro** :

| Champ | Quoi mettre |
|---|---|
| Adresse Firebase | l'adresse copiée à l'étape 3 |
| Votre prénom | `rachid` — et `nico` sur l'autre appareil |
| Code du salon | déjà rempli au hasard, cliquez **Générer** pour en changer |

Cliquer **Connecter**. Le message « À jour » confirme que ça marche.

## 6. Sur les autres appareils

Sur votre téléphone, sur l'ordinateur de Nico, etc. : mêmes **adresse** et
**code de salon**, mais chacun met **son propre prénom**.

- Même prénom = mêmes appareils, la collection se synchronise entre eux.
- Prénom différent = collection séparée, visible mais jamais fusionnée.

Le plus simple est de vous envoyer l'adresse et le code du salon par message.

---

## Retrouver sa collection plus tard

Nouveau téléphone, navigateur réinstallé, données effacées : il suffit de
remettre les **trois mêmes valeurs** dans la section Synchro.

| Champ | Doit être |
|---|---|
| Adresse Firebase | identique |
| Code du salon | identique, **caractère pour caractère** |
| Votre prénom | identique, **majuscules comprises** |

`rachid` et `Rachid` sont deux profils différents. Une faute de frappe ne
provoque pas d'erreur : elle crée simplement un profil vide, et vous verrez
`0 / 109` au lieu de votre collection. Dans ce cas, déconnectez-vous et
ressaisissez le bon prénom, rien n'est perdu.

Sur un appareil vierge, la collection descend toute seule. Si vous aviez déjà
coché des cases avant de vous connecter, le site vous demande quoi faire —
**fusionner** est presque toujours le bon choix : il garde tout des deux côtés.

Notez ces trois valeurs quelque part, ou gardez un export `.json` : sans elles,
la collection stockée sur Firebase est inaccessible.

## Ce que ça coûte

Rien. L'offre gratuite de Firebase inclut 1 Go de stockage et 10 Go de trafic
par mois. Deux collections de Sprites pèsent quelques kilo-octets.

Aucune carte bancaire n'est demandée sur le forfait gratuit.

## Ce que ça vaut côté confidentialité

Le code du salon **est** le mot de passe. Qui l'a peut lire et modifier les deux
collections. C'est proportionné pour des Sprites entre amis, mais :

- ne le publiez pas sur Discord ni ailleurs en public ;
- pour le changer, générez-en un nouveau et reconnectez les deux appareils
  (l'ancien salon reste dans la base, sans conséquence).

## Si ça ne marche pas

| Message | Cause | Correction |
|---|---|---|
| Adresse invalide | l'adresse ne finit pas par `.firebasedatabase.app` | recopier celle de l'étape 3, sans `/` ni `.json` à la fin |
| Accès refusé par Firebase | règles non publiées (base encore verrouillée), ou code de salon trop court | faire l'étape 4, et utiliser **Générer** |
| Le code doit faire 12 caractères | salon saisi à la main, trop court | cliquer **Générer** |
| Rien ne remonte sur l'autre appareil | prénoms identiques, ou salons différents | vérifier que le code du salon est **exactement** le même |

Pour voir ce que contient la base : console Firebase → **Realtime Database** →
onglet **Données**. Vous devez y voir `rooms` → votre code → `profiles` →
`rachid` et `nico`.

## Et si je préfère ne pas utiliser Firebase ?

La synchro est facultative. Sans elle, le site fonctionne exactement comme avant :
tout reste sur l'appareil, avec l'export en fichier `.json` et le lien de partage
pour transférer une collection.

Le dossier `server/` contient aussi une solution auto-hébergée (Cloudflare
Worker), plus solide mais qui demande un terminal.
