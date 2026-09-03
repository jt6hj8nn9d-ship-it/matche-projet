// server.js
// Ton serveur, qui lit maintenant les offres depuis la base de données
// (fichier db.js) au lieu de les avoir écrites en dur ici.

const express = require("express");
const cors = require("cors");
const db = require("./db"); // notre fichier de base de données

const app = express();
app.use(cors());

// Une route : quand quelqu'un demande /api/offres, on va chercher
// TOUTES les lignes de la table "offres" dans la base de données.
app.get("/api/offres", function (requete, reponse) {
  // .prepare(...) prépare la commande SQL, .all() l'exécute et renvoie
  // TOUTES les lignes correspondantes (contrairement à .get() qui n'en renvoie qu'une)
  const offres = db.prepare("SELECT * FROM offres").all();
  reponse.json(offres);
});

const PORT = 3000;
app.listen(PORT, function () {
  console.log("Serveur démarré sur http://localhost:" + PORT);
});
