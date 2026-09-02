// server.js
// Ceci est ton tout premier serveur. Il tourne "à côté" de ta page HTML,
// et répond quand quelqu'un lui demande quelque chose.

// On importe les bibliothèques installées avec npm install
const express = require("express");
const cors = require("cors");

// On crée l'application serveur
const app = express();

// cors() autorise ta page HTML (qui tourne dans le navigateur, sur une autre "adresse")
// à venir demander des données à ce serveur, sans être bloquée par sécurité
app.use(cors());

// Les mêmes 5 offres qu'avant, mais cette fois elles vivent dans le serveur,
// pas dans le fichier HTML. On ajoute "salaireMoyen" (un chiffre simple)
// en plus de "salaire" (le texte affiché), pour permettre le tri côté page.
const offres = [
  {
    titre: "Développeuse Front-end React",
    entreprise: "Ludovica Studio",
    ville: "Bordeaux",
    contrat: "CDI",
    salaire: "38–45k€",
    salaireMoyen: 41
  },
  {
    titre: "Chargé(e) de recrutement",
    entreprise: "Aravis RH",
    ville: "Lyon",
    contrat: "CDI",
    salaire: "32–36k€",
    salaireMoyen: 34
  },
  {
    titre: "Cuisinier de collectivité",
    entreprise: "Groupe Restauval",
    ville: "Bayonne",
    contrat: "CDD 6 mois",
    salaire: "1 900€/mois",
    salaireMoyen: 23
  },
  {
    titre: "Comptable fournisseurs",
    entreprise: "Ferbois SA",
    ville: "Toulouse",
    contrat: "CDI",
    salaire: "29–33k€",
    salaireMoyen: 31
  },
  {
    titre: "Technicien de maintenance",
    entreprise: "Atelier Voclain",
    ville: "Pau",
    contrat: "CDI",
    salaire: "27–31k€",
    salaireMoyen: 29
  }
];

// Une "route" : quand quelqu'un demande l'adresse /api/offres,
// on répond avec la liste des offres, au format JSON
app.get("/api/offres", function (requete, reponse) {
  reponse.json(offres);
});

// Le serveur écoute en permanence sur le port 3000 de ta machine.
// "Port" = une porte d'entrée numérotée sur ton ordinateur pour ce service précis.
const PORT = 3000;
app.listen(PORT, function () {
  console.log("Serveur démarré sur http://localhost:" + PORT);
});
