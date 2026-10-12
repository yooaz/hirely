# Hirely V529 R377 — référence canonique vérifiée (12 octobre 2026)

> **Source complète et exécutable : Google Drive, pas les anciens fichiers de ce dépôt GitHub.** Le dépôt `yooaz/hirely` contient un ancien code produit. Les fichiers `docs/handoffs/r377/` préservent le manifeste et un patch ciblé, **pas l'intégralité de la R377**. Ne pas fusionner le code ancien du dépôt dans le ZIP canonique.

## Source actuelle — vérifiée par re-téléchargement

| Rôle | URL Drive | Taille | SHA-256 |
| --- | --- | ---: | --- |
| **CANONIQUE R377** — `HIRELY_CURRENT_TESTABLE.zip` | https://drive.google.com/file/d/17e_77gQuRIAYq8U7UASnABF_LrVPT5-d/view | 99 969 727 octets | `4ecf0b282b7ceef3778016ec996638d1ef1637e0b9c49993717f40eb5c682c19` |
| **ROLLBACK R376** — `HIRELY_V529_R376_ROLLBACK_VERIFIED_2026-10-12.zip` | https://drive.google.com/file/d/1JcamwuHZuf9hdWvbKFqdrVb87jmPvNkJ/view | 99 435 310 octets | `9c16073a50b7acefb9531c6b6b9578b118068fe4911578a3bfb5355a94cd3f1e` |

R377 : 3 413 fichiers, ZIP CRC OK. R376 : 3 402 fichiers. Comparaison stricte R376 → R377 : **3 402 préservés**, **11 ajouts**, **3 fichiers modifiés** (`VERSION.txt`, `index.html`, `scripts/dev-server.mjs`), **aucun supprimé**. Les 19 lanceurs `.command` sont conservés avec leurs permissions.

## Correctif R377

Seul **Signature 013** est concerné : contenu long/noms composés, panneaux des contacts et de la photo. Nouvelle CSS `dist/hirely-r377-signature013-header.css` chargée dans l'interface et conditionnellement dans l'export PDF ; tous les autres modèles et les assets de la base sont préservés.

Tests documentés dans le ZIP `R377_QA/` : **3 PDF Signature 013** (standard, dense, dense + photo) A4 une page avec texte et contacts lisibles ; **2 PDF Signature 012 témoins** pixel-identiques et texte-identiques à R376 ; **22/22** garde-fous, **13/13** carrousel, **6/6** Premium, **10/10** continuation.

## Nettoyage Drive exécuté — contrôlé le 12 octobre

- L'ancienne archive **R375** supprimée après contrôle différentiel R375 → R376 : **0 fichier disparu**, 7 ajouts, 3 modifications. Le rollback indépendant est désormais **R376**.
- Une archive **R377 uploadée en double** supprimée après remplacement du fichier canonique stable et vérification de son SHA.
- Dossier actif **00_CURRENT_CANONICAL** : un seul ZIP **R377** ; dossier **HIRELY_PREVIOUS_BACKUP** : un seul ZIP **R376** et les rapports historiques (petits, conservés pour leur contenu).
- Aucune suppression de la base actuelle ni de la sauvegarde R376.

## Synchronisation GitHub — réalité

Le présent document, le manifeste JSON et le patch CSS sont intégrés sur `main` via PR #1 (squash `0b10b89add4b9ec0760b8daaaee903b702f32f3f`). **La source complète des 3 413 fichiers n'est pas encore répliquée sur GitHub.** Le dépôt `yooaz/hirely` est public ; le ZIP contient `data/hirely.sqlite` et des fichiers de configuration. Toute publication complète exige une exportation Git propre, l'exclusion des données/runtime/secrets, et une comparaison aux empreintes de la version canonique. Ne pas lancer de push à l'aveugle ni écraser `main`.

## Lancement

Décompresser le ZIP canonique R377 dans un **nouveau dossier**. Sur Mac, clic droit → Ouvrir sur `003_OUVRIR_HIRELY_MODE_STABLE_MAC.command`. Ne pas charger `index.html` en `file://`. Conserver R376 sur Drive pour revenir en arrière.

## Reste à faire avant publication

Audit individuel des **250 modèles** (standard/dense/photo), microtypographie et densité des autres modèles, parité éditeur ↔ PDF, tests physiques Mac/Safari/Chrome, paiement Stripe Premium 9 € en sandbox et contrôles de conformité/accessibilité. Les PDF témoins ne certifient pas à eux seuls l'ensemble du catalogue.

**Statut : R377 testable, mise en vente NO-GO.**
