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
3. Dans **Realtime Database → Rules**, remplace **toutes** les règles actuelles par le bloc complet ci-dessous, puis clique sur **Publier**. N'ajoute pas seulement le bloc `privateNotes` aux anciennes règles : un accès au niveau parent pourrait accorder l'accès aux enfants et annuler la confidentialité attendue.

Les tâches et les notes partagées sont enregistrées sous `farms/fs18/tasks` et `farms/fs18/notes`. Dans le panneau « Les notes », ouvre l'onglet **Publiques** ou **Personnelles** pour afficher uniquement les notes de ce compartiment. L'ajout d'une note l'enregistre dans le compartiment sélectionné. Les notes personnelles de chaque compte sont isolées sous `privateNotes/<UID>`. L'adresse e-mail et le mot de passe sont gérés par Firebase Authentication ; ne publie jamais de clé privée de compte de service.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "farms": {
      "fs18": {
        "tasks": {
          ".read": "auth != null && (auth.uid === 'BCizgnBvCGfFIoiOFeZBhCSE6Xm2' || auth.uid === 'W47n1dRP31NvfhguKrW6JjyJCM13')",
          ".write": "auth != null && (auth.uid === 'BCizgnBvCGfFIoiOFeZBhCSE6Xm2' || auth.uid === 'W47n1dRP31NvfhguKrW6JjyJCM13')"
        },
        "notes": {
          ".read": "auth != null && (auth.uid === 'BCizgnBvCGfFIoiOFeZBhCSE6Xm2' || auth.uid === 'W47n1dRP31NvfhguKrW6JjyJCM13')",
          ".write": "auth != null && (auth.uid === 'BCizgnBvCGfFIoiOFeZBhCSE6Xm2' || auth.uid === 'W47n1dRP31NvfhguKrW6JjyJCM13')"
        }
      }
    },
    "privateNotes": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid && (auth.uid === 'BCizgnBvCGfFIoiOFeZBhCSE6Xm2' || auth.uid === 'W47n1dRP31NvfhguKrW6JjyJCM13')",
        ".write": "auth != null && auth.uid === $uid && (auth.uid === 'BCizgnBvCGfFIoiOFeZBhCSE6Xm2' || auth.uid === 'W47n1dRP31NvfhguKrW6JjyJCM13')"
      }
    }
  }
}
```

Pour mettre en ligne les changements, envoie `index.html` sur GitHub et recharge le site Pages. Les anciennes tâches conservées dans le stockage local d'un navigateur ne sont pas importées automatiquement dans la base.
