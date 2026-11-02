# FS-18-

Petit espace privé pour organiser une survie Farming Simulator 18 à deux.

## Lancer le site

Installe Node.js 18 ou une version plus récente, puis lance depuis ce dossier :

```sh
npm start
```

Ouvre ensuite <http://localhost:3000>. Aucun paquet externe n'est nécessaire.

N'ouvre pas `index.html` directement et n'utilise pas Live Server ou GitHub Pages : ces options servent uniquement des fichiers statiques et ne peuvent pas enregistrer les tâches. Si le site indique que son serveur ne répond pas, laisse `npm start` tourner dans le terminal et ouvre <http://localhost:3000>.

## Comptes

- **Paul** — mot de passe `admin`
- **Noé** — mot de passe `Noé43`

Le serveur protège la page et toutes les routes de données avec une session HTTP. Les mots de passe ne sont pas envoyés au navigateur : seuls leurs vérificateurs PBKDF2 sont conservés dans `server.js`. Les tentatives de connexion sont limitées.

## Utilisation

Les deux comptes partagent les tâches et les notes. Les données sont enregistrées dans `data.json` à côté du serveur et restent disponibles après son redémarrage sur la même machine. Ce fichier est ignoré par Git pour ne pas publier le contenu du carnet ; sauvegarde-le pour conserver une copie.

Pour rendre le site accessible sur Internet, héberge le serveur Node.js derrière HTTPS, configure un disque persistant pour `data.json` et réserve l'accès à des personnes de confiance. Le compte Paul utilise le mot de passe demandé `admin`, qui est trop facile à deviner pour un service exposé publiquement ; ne déploie pas ces identifiants tels quels sur Internet.
