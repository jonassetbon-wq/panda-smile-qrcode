// Webinaire « Prolonger la rééducation myofonctionnelle à la maison » (Dr Olivier Setbon).
// Les participants saisissent eux-mêmes prénom, nom et e-mail : plus de liste d'inscrits ici.
export const WEBINAR = {
  id: "webi-1",
  title: "Prolonger la rééducation myofonctionnelle à la maison",
};

export const attendees = [];

export const findAttendee = (id) => attendees.find((a) => a.id === id);

export const CHOICES = {
  learned: ["Un peu", "Beaucoup", "Énormément"],
  length: ["Trop courte", "Parfaite", "Trop longue"],
  tryApp: ["Oui, dès maintenant", "Je veux d'abord en savoir plus", "Pas pour l'instant"],
  profession: ["Orthodontiste", "Orthophoniste", "Chirurgien-dentiste", "Kinésithérapeute maxillo-facial"],
  source: ["LinkedIn", "Instagram", "Facebook", "Un confrère", "E-mail ou newsletter", "Orthoplus", "Recherche Internet"],
};
