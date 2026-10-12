# Hirely V529 R377 — reprise fidèle / handoff (2026-10-12)

> **ATTENTION — BRANCHE DOCUMENTAIRE UNIQUEMENT.**
> Ce dépôt GitHub n'est **pas** la base canonique R376/R377 : son historique et sa structure sont plus anciens.
> Ne pas fusionner cette branche ni prétendre qu'elle contient l'application R377 complète.

## Source canonique

- Base complète : `HIRELY_CURRENT_TESTABLE.zip` dans le dossier Google Drive **HIRELY / 00_CURRENT_CANONICAL** ; archive vérifiée V529 R376.
- Archive source R376 : 3 402 entrées ; 19 exécutables Mac avec permissions `+x`.
- Sauvegarde R375 distincte dans le dossier Drive **HIRELY_PREVIOUS_BACKUP** ; ne pas supprimer.
- R377 préparée à partir de R376 par copie vérifiée : 3 413 entrées, 11 nouvelles, 3 fichiers modifiés, zéro entrée supprimée.
- Empreinte ZIP complet R377 (SHA-256) : `4ecf0b282b7ceef3778016ec996638d1ef1637e0b9c49993717f40eb5c682c19`.
- Taille ZIP R377 : 99 969 727 octets.
- Le ZIP R377 a été délivré sous forme de pièce jointe dans la conversation ChatGPT du 12 octobre 2026. **Il n'a pas été téléversé sur Google Drive** (Drive a répondu HTTP 403) et **l'application entière n'a pas été publiée sur GitHub**.

## Patch R377 (signature-013 uniquement)

- `VERSION.txt` : V529 R377
- `index.html` : charger `dist/hirely-r377-signature013-header.css?build=r377` après R375
- `scripts/dev-server.mjs` : charger exactement cette feuille CSS pour `payload.template === 'signature-013'` au rendu PDF
- Ajout : `dist/hirely-r377-signature013-header.css` (copie de la feuille autonome incluse dans ce dossier documentaire GitHub).
- Le reste du moteur, des assets, des fichiers précompressés JS/CSS, des autres 249 modèles, des paiements, de la configuration et des lanceurs conserve les octets originaux R376.

## Vérifications réellement exécutées

- Signature 013 : standard, dense, dense avec photo : **3/3 PDF A4 sur une page**, nom et contacts présents, sans texte hors des limites.
- Signature 012, standard + dense : PDF de contrôle **pixel-identiques et texte-identiques** entre R376 et R377. Les SHA de leurs fichiers PDF changent uniquement en raison de leurs horodatages de création.
- Contrôles ciblés : runtime 22/22, carrousel 13/13, continuation Premium 6/6, continuation 10/10.
- Comparaison ZIP fichier par fichier : **3 402 sources originelles préservées**, seuls `index.html`, `VERSION.txt`, `scripts/dev-server.mjs` changent.
- **Limites :** audits de l'ensemble des 250 modèles incomplets ; microtypographie trop petite sur certains autres modèles ; essais Mac/Safari réels et Stripe 9 € sandbox non faits.

## Instructions de reprise sans perte

1. Télécharger **l'archive canonique complète R376** et vérifier son intégrité.
2. Télécharger l'archive R377 complète jointe dans la livraison du 12 octobre et vérifier le SHA ci-dessus, **avant** d'en faire la source.
3. Ne **pas** fusionner les anciennes sources GitHub directement dans R377.
4. Vérifier chaque fichier original, les permissions Mac, les PDF témoins, les caches compressés et les principaux parcours avant publication et tout remplacement de Drive.
5. Si la livraison complète R377 n'est pas accessible, repartir de R376 intacte et appliquer seulement le patch précisément décrit, sans toucher aux autres fichiers.

**Statut : R377 testable localement ; publication commerciale NO-GO tant que tous les contrôles prévus ne sont pas terminés.**
