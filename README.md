# FS-18-

Carnet de tâches et de notes pour une survie Farming Simulator 18 à deux.

## Publier sur GitHub Pages

Ce site fonctionne comme un site statique : il n'a pas besoin de Node.js, de `npm start` ni d'un serveur. Dans les paramètres GitHub du dépôt, active **Pages** avec la branche et le dossier qui contiennent `index.html`. Après avoir envoyé les dernières modifications sur GitHub, ouvre l'adresse GitHub Pages du dépôt.

## Comptes Firebase

- La connexion utilise l'adresse e-mail et le mot de passe Firebase de chaque utilisateur.
- Paul et Noé sont reconnus par leurs UID Firebase, et seuls ces deux UID sont acceptés par le site.
- Aucun formulaire d'inscription n'est proposé : crée les comptes dans Firebase Authentication.

## Configurer Firebase

L'application Web Firebase et sa Realtime Database sont configurées dans `index.html`. Le SDK Firebase est chargé depuis le CDN officiel, ce qui permet de publier le site statique sur GitHub Pages sans serveur ni npm.

Dans la console Firebase :

1. Active **E-mail/Mot de passe** dans **Authentication → Sign-in method** et crée les deux utilisateurs.
2. Dans **Authentication → Settings → Authorized domains**, ajoute le domaine GitHub Pages du site si nécessaire (`<pseudo>.github.io`).
3. Dans **Realtime Database → Rules**, autorise uniquement les deux UID des comptes Paul et Noé sous `farms/fs18`. N'active pas le mode test et ne publie pas de règles permettant l'accès public.

Les tâches et les notes sont enregistrées sous `farms/fs18` et se synchronisent en direct entre les appareils connectés. L'adresse e-mail et le mot de passe sont gérés par Firebase Authentication ; ne publie jamais de clé privée de compte de service.

Pour mettre en ligne les changements, envoie `index.html` sur GitHub et recharge le site Pages. Les anciennes tâches conservées dans le stockage local d'un navigateur ne sont pas importées automatiquement dans la base.
