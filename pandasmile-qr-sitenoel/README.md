# PandaSmile · QR codes ambassadeurs

Site Netlify (pandasmile.shop) :

- `/` : espace ambassadeurs. Chacun choisit son prénom et tape son code à 6 chiffres, puis affiche son QR code personnel. Olivier S. (admin) glisse ensuite vers **Stats**, **Inscrits** et **Carte**, mis à jour en direct, avec export Excel.
- `/s/<ambassadeur>` : adresse encodée dans chaque QR code. Note le scan (anonyme : heure, téléphone, ville approximative, sans IP) puis ouvre le formulaire.
- `/f/` : formulaire praticiens (offre 3 mois offerts, case RGPD, CGU).
- `/w/` : questionnaire du webinaire. Le participant touche son nom dans la liste (`netlify/functions/lib/webinar.mjs`, e-mails jamais envoyés à la page), note le webinaire, peut recommander un confrère, puis reçoit le code promo.
- `/w/ecran.html` : écran 16:9 avec le QR code, à partager sur Zoom.
- `/noel/` : jeu concours de Noël « Combien pèse le nounours ? » (QR code de l'affiche). L'affiche s'affiche, puis le nounours s'envole au défilement et laisse place au formulaire (prénom, nom, e-mail, téléphone, pronostic de 100 g à 3 kg). Une participation par e-mail et par téléphone. Fin du jeu : 31/12/2026 à minuit (`netlify/functions/lib/noel.mjs`).
- Admin : la bascule **JO / Webi / Noël** en haut change Stats, Inscrits, Carte et l'export Excel. En mode Noël, Stats contient le tirage : poids réel du nounours, tirage au sort du casque parmi les bonnes réponses (poids réel arrondi à 100 g, sinon les pronostics les plus proches), choix à la main du gagnant du nounours depuis Inscrits, puis envoi de l'e-mail à chaque gagnant.

E-mails (jeu de Noël) : via Resend. Variables d'environnement Netlify : `RESEND_API_KEY` (obligatoire), `MAIL_FROM` (par défaut `PandaSmile <concours@pandasmile.shop>`, domaine à vérifier dans Resend), `MAIL_REPLY_TO` (facultatif). Sans clé, les participations sont enregistrées mais aucun e-mail ne part.

Stockage : Netlify Blobs. Seul service externe : Resend, pour les e-mails du jeu de Noël. Les données de plus de 3 mois sont effacées chaque nuit (`netlify/functions/cleanup.mjs`).
Les codes secrets ne sont stockés que sous forme hachée (`netlify/functions/lib/people.mjs`). Garder ce dépôt **privé**.
