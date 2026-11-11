// Journal des mises à jour de l'appli BDE, affiché dans Réglages > Mises à jour.
// À chaque nouvelle mise en ligne : ajouter une version EN HAUT de la liste (la plus récente d'abord).
export const CHANGELOG = [
  {
    v: 'BDE 4.1', date: '11 novembre 2026', title: 'Résultats du concours, scan et Équipe',
    items: [
      'Équipe : le bandeau d’un pôle ou d’une personne flotte en bas, au-dessus de la barre ; il ne coupe plus le cercle du BDE.',
      'Scan : toucher l’image fait la mise au point à cet endroit (carré jaune), rester appuyé la bloque, toucher encore la débloque. Lampe quand le téléphone le permet. Sur iPhone, Safari ne laisse pas régler la mise au point : elle reste automatique.',
      'Toucher l’heure en haut de l’iPhone fait remonter l’écran affiché (appli de l’écran d’accueil).',
      'Toucher n’importe où dans la bande du haut remonte aussi l’écran.',
      'Scan : un carré de verre liquide, avec deux reflets qui se font face, montre la zone idéale où placer le QR (toute l’image reste lue).',
      'Inscrits : nouveaux filtres « Offerts » (billets gratuits) et « −50 % » ; les billets à −50 % sont marqués comme tels.',
      'Concours : bouton Résultats pour voir qui a pris sa place avec son code (place offerte ou −50 %), qui avait déjà un billet, qui a acheté sans le code, qui n’a rien pris, et qui est venu à la soirée.',
      'Chaque participant affiche son billet (« Billet n° 0042, venu », « Pas de billet »…), et le Bilan reprend ces résultats.',
    ],
  },
  {
    v: 'BDE 4.0', date: '11 novembre 2026', title: 'Notifications, couleurs partout et scan plein écran',
    items: [
      'Notifications sur le téléphone même quand l’appli est fermée (appli ajoutée à l’écran d’accueil) : nouvelle vente, palier, candidat, concours, demande de Gaspard, réponse de Jonas.',
      'Demande de Gaspard : un bandeau apparaît dès l’ouverture de l’appli chez Jonas, avec Valider et Refuser. Gaspard est prévenu de la réponse.',
      'La couleur choisie recolore toute l’appli : fonds d’Inscrits, Recrutement et Équipe, barre, cartes, graphiques, Bilan, Réglages, tuto. Concours reste blanc, Scan noir, Merch violet.',
      'Scan : la caméra remplit tout l’écran, sans cadre ni rectangles ; il suffit que le QR soit dans l’image.',
      'Ordre des onglets : reste appuyé sur un onglet dans les Réglages, puis fais-le glisser vers le haut ou le bas.',
      'Réglages : la fenêtre s’ouvre déjà remplie, plus rien ne saute à l’ouverture.',
      'Tuto : la bulle n’apparaît qu’une fois en place et ne bouge plus ; Retour et Suivant ont la même largeur.',
      'Bilan : une légende sur chaque graphique ; toucher une barre la met en avant (les autres passent en gris) et donne sa valeur exacte. Textes plus précis partout.',
      'Appli de l’écran d’accueil : la barre d’onglets n’est plus coupée en bas.',
    ],
  },
  {
    v: 'BDE 3.9', date: '11 novembre 2026', title: 'Réglages, Bilan, Merch et tuto',
    items: [
      'Nouveau bouton Réglages en haut à droite.',
      'Réglages de la soirée pour Jonas et Gaspard : ouvrir ou fermer la vente, changer un prix ou une jauge, créer des codes invitation, ouvrir ou fermer le concours. Plus besoin de passer par Supabase.',
      'Les changements de Gaspard partent en demande : Jonas les valide ou les refuse, avec une pastille sur le bouton Réglages.',
      'Réglages perso pour chacun : ordre des onglets, 6 couleurs, écran d’ouverture, vibration et bip du scan, texte plus grand, animations réduites.',
      'Notifications dans l’appli (désactivées au départ) : nouvelle vente, palier de 25 billets, nouveau candidat, inscription au concours, demande de validation.',
      'Tuto au premier lancement, qui montre les gestes et raccourcis. Il se relance avec 💡 dans les Réglages.',
      'Bouton Bilan en haut : résumé recalculé à chaque ouverture (ventes, argent, visiteurs, sources), résumé approfondi façon bilan Back to Reality, et comparaison avec BTR.',
      'Compteur de visites anonyme sur le site (sans cookie) pour le Bilan.',
      'Merch : quand la liste sera importée, un onglet Merch apparaît, et le scan passe en violet si la personne a du merch à récupérer, avec « Merch donné » ou « Plus tard ».',
      'Conditions générales mises à jour : prix unique, codes invitation et réduction, règlement du jeu concours, statistiques anonymes.',
      'Cette liste des mises à jour.',
      'Billetterie fermée depuis l’appli : chaque place affiche « Vente fermée ».',
      'Avec 6 onglets, les noms de la barre restent bien espacés sur téléphone.',
    ],
  },
  {
    v: 'BDE 3.8', date: '11 novembre 2026', title: 'Verre liquide et écrans collés',
    items: [
      'Les écrans sont collés côte à côte et suivent le doigt (ou le trackpad sur ordinateur, ou les flèches du clavier).',
      'La pastille de la barre se presse, gonfle, et se fait glisser comme un curseur d’un onglet à l’autre.',
      'Une couleur par écran : Scan noir, Inscrits bleu nuit, Concours blanc, Recrutement bleu vif, Équipe nuit.',
      'Grand titre en haut de chaque écran, et verre liquide retravaillé partout (reflet, liseré, profondeur).',
      'Ordinateur en plein écran : onglets en haut, chiffres fixes à gauche et liste à droite sur Inscrits, organigramme centré.',
      'Flou progressif en haut quand on fait défiler, barre de recherche collée sous l’en-tête.',
      'Billet entré : lueur verte qui suit l’arrondi de la carte.',
      'Équipe : toucher ailleurs remet la vue d’ensemble.',
      'Billet extra : s’ouvre au-dessus de tout, avec un bouton × pour fermer (et Échap sur ordinateur).',
      'Correctifs : plus de bande noire en haut ni en bas sur iPhone, une fiche ouverte n’agrandit plus sa voisine, l’effet verre reste sur la caméra du scan.',
    ],
  },
  {
    v: 'BDE 3.7', date: '10 novembre 2026', title: 'Nouveau design et places à 5 €',
    items: [
      'Toute l’appli passe en verre dépoli sur fond bleu nuit, comme l’organigramme.',
      'Connexion : prénoms sur 3 colonnes, la dernière ligne prend toute la largeur.',
      'Billetterie : toutes les places à 5 € (Regular, 330 places), Late supprimé.',
      'Billetterie : ligne « Jeu concours » sous les places, vers bureau31.fr/concours.',
    ],
  },
  {
    v: 'BDE 3.6', date: '9 novembre 2026', title: 'Barre d’onglets en bas',
    items: [
      'Les 5 onglets passent dans une barre fixe en bas, avec une icône chacun.',
      'Plus rien ne se tire ni ne rebondit hors des listes.',
      'Glisser à gauche ou à droite pour changer d’écran.',
      'Équipe : Jeanne présidente, Gaspard vice-président.',
      'Recrutement n’est plus en bleu quand l’onglet n’est pas ouvert.',
    ],
  },
  {
    v: 'BDE 3.5', date: '9 novembre 2026', title: 'Onglet Équipe',
    items: [
      'Organigramme interactif du BDE : 8 pôles, responsables et membres.',
      'Toucher un pôle ou un prénom pour voir qui fait quoi.',
      'Rôle de chacun, une fiche par personne.',
    ],
  },
  {
    v: 'BDE 3.4', date: '9 novembre 2026', title: 'Scan et onglets',
    items: [
      'La caméra ne demande plus l’autorisation à chaque changement d’écran.',
      'L’appli s’ouvre sur Inscrits, le Scan est juste à gauche.',
      'Un code personnel à 6 chiffres pour chaque membre de l’équipe.',
    ],
  },
  {
    v: 'BDE 3.3', date: '9 novembre 2026', title: 'Concours',
    items: [
      'Page publique bureau31.fr/concours : 15 places à gagner.',
      'Onglet Concours : participants, gagnants à cocher, envoi des résultats par mail.',
      'Les gagnants reçoivent un code place offerte, les autres un code −50 %.',
    ],
  },
  {
    v: 'BDE 3.2', date: '6 novembre 2026', title: 'Billetterie enrichie',
    items: [
      'Bouton flottant « Réserver » avec le compte à rebours.',
      'Bloc merch : première distribution pendant l’afterwork.',
      'Nouvelle icône du site, affiche retravaillée, carte du Plein Soleil.',
    ],
  },
  {
    v: 'BDE 3.1', date: '4 novembre 2026', title: 'Recrutement',
    items: [
      'Page bureau31.fr/recrutement : réserver un créneau d’entretien.',
      'Onglet Recrutement : planning des entretiens, filtres par pôle et année, export Excel.',
    ],
  },
  {
    v: 'BDE 3.0', date: '2 novembre 2026', title: 'Afterwork au Plein Soleil',
    items: [
      'Le site passe de Back to Reality à l’Afterwork du jeudi 12 novembre au Plein Soleil.',
      'Nouvelle identité : crème, bordeaux et or, cuir en texture.',
      'Billetterie en paliers, atelier de chaque billet, codes invitation.',
      'Appli BDE : scan, liste des inscrits, billet extra, remboursements, export Excel.',
    ],
  },
];
export const VERSION = CHANGELOG[0].v;
