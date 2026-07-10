# BRAC V1.1 — Création APK Android

Cette version ajoute :
- nom d'application : BRAC ;
- icône haltère/dumbbell violet/noir ;
- écran d'accueil avec 3 boutons : Créer, Démarrer, Stats ;
- création de 10 séances maximum ;
- bibliothèque d'exercices classée par polyarticulaire A-Z ou groupe musculaire ;
- séries, répétitions, charge estimée, tempo, repos série, repos exercice ;
- estimation temps global, calories et tonnage ;
- démarrage d'une séance créée ;
- échauffement optionnel ;
- suivi des séries avec reps/poids réellement réalisés ;
- bouton repos avec chrono et alerte rouge ;
- bilan estimé/réalisé ;
- progression +1 rep ou +1 kilo ;
- statistiques calories et tonnage estimés/réalisés.

## Conformité Android

Le projet Expo n'ajoute aucune permission Android sensible :

```json
"permissions": []
```

L'APK généré avec EAS est signé avec une clé Android générée par Expo. Il ne modifie pas le système Android et ne demande pas d'accès dangereux.

## Commandes

Dans le dossier `brac-v1-1-app` :

```cmd
npm install
npm install -g eas-cli
set EAS_NO_VCS=1
eas login
eas init
eas build -p android --profile preview
```

À la fin, EAS donne un lien `.apk` téléchargeable.

Si EAS demande :

```txt
Generate a new Android Keystore?
```

Répondre :

```txt
Y
```
