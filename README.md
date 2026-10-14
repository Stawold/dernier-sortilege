# Dernier Sortilège

Battle royale de magiciens dans un château labyrinthe 13×13 (case centrale refuge), en 3D à la première personne, jouable dans le navigateur (téléphone compris).
De 4 à 12 magiciens (humains + bots de remplissage), tous jouent en même temps, 20 secondes par tour.

## Règles en bref
- Une action par tour : avancer, reculer, pas de côté (qui fait aussi tourner), pivoter face à un mur, ou lancer le sort.
- Le sort part tout droit et tue le premier magicien en vue **s'il tourne le dos ou le flanc** (jamais face à face).
- Brume : elle démarre au tour 10, puis avance d'un cran tous les 5 tours.
- 20 secondes pour choisir. Sans choix à temps, le magicien est éliminé d'office.
- 3 bonus par carte : **bleu** (traverser un mur une fois, en avançant ou reculant), **vert** (bouclier : annule un sort), **jaune** (révèle tous les magiciens sur le radar pendant un tour).

## Lancer en local
```bash
npm install
npm start          # http://localhost:3000
```
Ouvrez la page dans deux onglets : « Jouer avec des amis » → créer une salle → l'autre onglet rejoint avec le code.
Sur le même réseau Wi-Fi, les amis ouvrent `http://<ip-de-votre-ordinateur>:3000`.

## Mettre en ligne (le plus simple : un seul service)
Le serveur Node sert à la fois la page et la connexion temps réel (WebSocket). Il faut donc un hébergeur qui exécute Node :

**Render (offre gratuite)**
1. Créer un dépôt GitHub avec ce dossier.
2. Sur render.com : *New → Web Service* → choisir le dépôt. Le fichier `render.yaml` règle tout (build `npm install`, démarrage `npm start`).
3. L'adresse `https://dernier-sortilege.onrender.com` est le jeu. Partagez-la : chacun crée ou rejoint une salle avec son code.
   (Offre gratuite : le service s'endort après ~15 min sans visite, le premier chargement prend alors une minute. Ouvrez la page quelques minutes avant la partie.)

Railway, Fly.io ou n'importe quel VPS fonctionnent aussi : `npm install` puis `npm start`, la variable `PORT` est lue automatiquement.

**Netlify ?** Netlify n'héberge que des fichiers statiques, pas de WebSocket. Possible uniquement pour la page, avec le serveur ailleurs :
1. Déployer le dossier `public/` sur Netlify.
2. Dans `public/config.js`, indiquer `window.WS_URL = 'wss://<votre-service>.onrender.com/ws';`
3. (Optionnel) Sur le serveur, `ORIGINS=https://votre-site.netlify.app` limite les connexions à ce site.

## Fonctionnement
- `engine.js` : moteur de règles pur, déterministe (graine). Utilisé par le serveur et par chaque navigateur.
- `server.js` : salles à code de 4 lettres, minuteur de 20 s, bots, élimination des absents. À chaque tour il diffuse les actions de tous ; chaque navigateur rejoue le même moteur avec la même graine et obtient exactement la même partie (un contrôle d'empreinte détecte toute désynchronisation).
- `src/` : code de la page (`template.html`, `game.js`, `assets.js` avec images et modèle 3D intégrés). `npm run build` (Python 3) régénère `public/index.html`.
- Un joueur déconnecté en cours de partie est éliminé au tour suivant (pas de reconnexion pour l'instant).

## Tests
```bash
npm test     # règles du jeu (25 tests, 800 parties de bots) + protocole multijoueur de bout en bout
```

## Crédits
- Modèle 3D du magicien : fichier « Wizard-Finished.blend » fourni avec son LISEZ-MOI. L'auteur demande d'être crédité et interdit de revendre le personnage seul ou dans un pack. **Ajouter ici son nom** (`À compléter`).
- Tableaux et textures : images fournies par le créateur du jeu.
- Rendu : three.js (r128, chargé depuis cdnjs). Polices : Cinzel et Cinzel Decorative (Google Fonts).

## Réseau et reconnexion

- Tout passe par le serveur (WebSocket `wss://` quand la page est en https) : chaque joueur peut être sur une connexion différente (wifi, 4G, 5G, box d'un autre foyer) sans configuration. Il suffit que le serveur soit joignable en https.
- Chaque joueur reçoit un jeton secret à son arrivée dans la salle. Si la connexion tombe (passage wifi ↔ 4G, tunnel, écran verrouillé, onglet rechargé), le jeu se reconnecte tout seul et le serveur renvoie l'historique des tours : le client rejoue la partie d'un coup et retrouve l'état exact.
- **Délai de grâce : 60 s** (variable `GRACE_MS`). Pendant ce temps le magicien reste sur place (il « attend ») ; passé ce délai, il est éliminé d'office. Quitter volontairement (bouton) libère la place tout de suite.
- Un salon dont un joueur est parti garde sa place 60 s ; l'hôte passe à un joueur connecté.
- Hébergement gratuit Render : le serveur s'endort après inactivité, le premier chargement peut prendre ~50 s. Ouvrez la page avant de lancer la partie.
- Test avec un réseau dégradé : `LAG=250 npm test` ajoute ~250 ms par sens à toutes les connexions de test.
