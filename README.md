# PandaSmile · QR codes ambassadeurs

Site Netlify (pandasmile.shop) :

- `/` : espace ambassadeurs. Chacun choisit son prénom et tape son code à 6 chiffres, puis affiche son QR code personnel. Olivier S. (admin) glisse ensuite vers **Stats**, **Inscrits** et **Carte**, mis à jour en direct, avec export Excel.
- `/s/<ambassadeur>` : adresse encodée dans chaque QR code. Note le scan (anonyme : heure, téléphone, ville approximative, sans IP) puis ouvre le formulaire.
- `/f/` : formulaire praticiens (offre 3 mois offerts, case RGPD, CGU).

Stockage : Netlify Blobs (aucun service externe). Les données de plus de 3 mois sont effacées chaque nuit (`netlify/functions/cleanup.mjs`).
Les codes secrets ne sont stockés que sous forme hachée (`netlify/functions/lib/people.mjs`). Garder ce dépôt **privé**.
