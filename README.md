# PandaSmile · QR codes ambassadeurs

Site Netlify (pandasmile.shop) :

- `/` : espace ambassadeurs. Chacun choisit son prénom et tape son code à 6 chiffres, puis affiche son QR code personnel. Olivier S. (admin) glisse ensuite vers **Stats**, **Inscrits** et **Carte**, mis à jour en direct, avec export Excel.
- `/s/<ambassadeur>` : adresse encodée dans chaque QR code. Note le scan (anonyme : heure, téléphone, ville approximative, sans IP) puis ouvre le formulaire.
- `/f/` : formulaire praticiens (offre 3 mois offerts, case RGPD, CGU).
- `/w/` : questionnaire du webinaire. Le participant touche son nom dans la liste (`netlify/functions/lib/webinar.mjs`, e-mails jamais envoyés à la page), note le webinaire, peut recommander un confrère, puis reçoit le code promo.
- `/w/ecran.html` : écran 16:9 avec le QR code, à partager sur Zoom.
- `/noel/` : jeu concours de Noël « Combien pèse le nounours ? » (QR code de l'affiche). L'affiche s'affiche, puis le nounours s'envole au défilement et laisse place au formulaire (prénom, nom, e-mail, téléphone, pronostic de 100 g à 3 kg). Une participation par e-mail et par téléphone. Aucun e-mail n'est envoyé. Fin du jeu : 31/12/2026 à minuit (`netlify/functions/lib/noel.mjs`).
- Admin : la bascule **JO / Webi / Noël** en haut change Stats, Inscrits, Carte et l'export Excel. En mode Noël, Stats contient les gagnants : Olivier tape le poids réel du nounours, tous les pronostics s'affichent autour de ce poids (plus lourds au-dessus, plus légers en dessous, filtres Au-dessus / En dessous), et il donne à la main le casque 🎧 et le nounours 🧸. Aucun tirage au sort, aucun e-mail : le cabinet prévient les gagnants (téléphone et e-mail affichés).
- `/noel/` : neige qui tombe, et poudreuse qui s'accumule doucement en bas de l'écran si on reste sur la page.

Stockage : Netlify Blobs (aucun service externe). Les données de plus de 3 mois sont effacées chaque nuit (`netlify/functions/cleanup.mjs`).
Les codes secrets ne sont stockés que sous forme hachée (`netlify/functions/lib/people.mjs`). Garder ce dépôt **privé**.
