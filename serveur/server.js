// server.js
// Ton serveur : lit les offres depuis la base de données,
// et permet maintenant aussi d'en AJOUTER une nouvelle.

const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());

// Nouveau : express.json() permet au serveur de comprendre les données
// envoyées en JSON dans le corps d'une requête (indispensable pour recevoir
// les infos du formulaire "nouvelle offre").
app.use(express.json());

// Route existante : lire toutes les offres
app.get("/api/offres", function (requete, reponse) {
  const offres = db.prepare("SELECT * FROM offres").all();
  reponse.json(offres);
});

// Nouvelle route : ajouter une offre.
// app.post (au lieu de app.get) réagit quand la page ENVOIE des données,
// pas quand elle en demande.
app.post("/api/offres", function (requete, reponse) {

  // requete.body contient les données envoyées par la page,
  // grâce à express.json() configuré plus haut
  const { titre, entreprise, ville, contrat, salaire, salaireMoyen } = requete.body;

  // On prépare puis exécute l'insertion, comme dans db.js
  const insererOffre = db.prepare(`
    INSERT INTO offres (titre, entreprise, ville, contrat, salaire, salaireMoyen)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const resultat = insererOffre.run(titre, entreprise, ville, contrat, salaire, salaireMoyen);

  // resultat.lastInsertRowid contient l'id que la base vient d'attribuer
  // à cette nouvelle ligne. On renvoie l'offre complète, id compris.
  reponse.json({
    id: resultat.lastInsertRowid,
    titre, entreprise, ville, contrat, salaire, salaireMoyen
  });
});

const PORT = 3000;
app.listen(PORT, function () {
  console.log("Serveur démarré sur http://localhost:" + PORT);
});
