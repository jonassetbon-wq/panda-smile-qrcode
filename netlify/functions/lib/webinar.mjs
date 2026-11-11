// Webinaire « Prolonger la rééducation myofonctionnelle à la maison » (Dr Olivier Setbon).
// Liste des inscrits : l'e-mail reste côté serveur, la page n'affiche que « Prénom + initiale ».
export const WEBINAR = {
  id: "webi-1",
  title: "Prolonger la rééducation myofonctionnelle à la maison",
};

export const attendees = [
  { id: "w01", label: "Hela H.", name: "Hela Hedfi", email: "hallahedfi98@gmail.com" },
  { id: "w02", label: "Aurore C.", name: "Aurore Cotes", email: "aurore.cotes23@gmail.com" },
  { id: "w03", label: "Violaine D.", name: "Violaine Désert", email: "violaine.desert@orange.fr" },
  { id: "w04", label: "Lucie C.", name: "Lucie Courtois", email: "luciecourtois84@gmail.com" },
  { id: "w05", label: "Fabien G.", name: "Fabien Gaume", email: "fabgaume@gmail.com" },
  { id: "w06", label: "Chloé C.", name: "Chloe Canonne", email: "chloecanonne.pro@gmail.com" },
  { id: "w07", label: "Bertille D.", name: "Bertille Delamotte", email: "bertille.delamotte@gmail.com" },
  { id: "w08", label: "Stéphanie B.", name: "Stéphanie Berthier Noël", email: "s.berthiernoel@gmail.com" },
  { id: "w09", label: "Stella G.", name: "Stella Grimaldi", email: "stella_grimaldi@icloud.com" },
  { id: "w10", label: "Ftim Zohra", name: "Ftim Zohra", email: "b.fzohra@gmail.com" },
  { id: "w11", label: "Aurélie K.", name: "Aurélie Kherchi", email: "mouchard.a@gmail.com" },
  { id: "w12", label: "Laetitia R.", name: "Laetitia Robert", email: "letissia1981@hotmail.fr" },
  { id: "w13", label: "Doga L.", name: "Doga Louis Martinez", email: "dogalouismartinez@gmail.com" },
  { id: "w14", label: "Rihab A.", name: "Rihab Agrebi", email: "rihabagrebi4@gmail.com" },
  { id: "w15", label: "Coralie B.", name: "Coralie Berthonneau", email: "berthonneau.coralie@gmail.com" },
];

export const findAttendee = (id) => attendees.find((a) => a.id === id);

export const CHOICES = {
  learned: ["Beaucoup", "Quelques-unes", "Pas vraiment"],
  liked: ["Les exercices à faire à la maison", "La motivation des enfants et l'observance", "Les cas cliniques", "La présentation de PandaSmile", "Les questions-réponses"],
  length: ["Trop courte", "Parfaite", "Trop longue"],
  tryApp: ["Oui, dès maintenant", "Je veux d'abord en savoir plus", "Pas pour l'instant"],
  profession: ["Orthodontiste", "Orthophoniste", "Chirurgien-dentiste", "Kinésithérapeute maxillo-facial"],
  source: ["LinkedIn", "Instagram", "Facebook", "Un confrère", "E-mail ou newsletter", "Orthoplus", "Recherche Internet"],
};
