// Galette des rois 2027 au cabinet d'Auxerre : inscriptions (nom, prénom, e-mail, téléphone).
export const GALETTE = {
  id: "galette-2027",
  title: "Partageons la galette des rois",
  date: "Mardi 19 janvier 2027 à 19 h",
  place: "Cabinet d'orthodontie, 7 rue Frédéric Bertrand, 89000 Auxerre",
  phone: "03 86 52 22 38",
  rsvpBy: "vendredi 8 janvier 2027",
  // L'affiche demande une réponse avant le 8 janvier ; on laisse s'inscrire jusqu'au jour J à midi (heure de Paris).
  closesAt: "2027-01-19T11:00:00.000Z",
};
export const isOpenGalette = (now = Date.now()) => now < Date.parse(GALETTE.closesAt);
