// server.js

// Nouveau : dotenv charge le contenu de .env dans process.env
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./db");
const franceTravail = require("./franceTravail");

const app = express();
app.use(cors());
app.use(express.json());

// Nouveau : express-session permet de garder en mémoire, côté serveur,
// qui est connecté. Le serveur envoie au navigateur un petit "ticket"
// (un cookie), et le navigateur le renvoie automatiquement à chaque
// requête suivante pour prouver "c'est toujours moi".
app.use(session({
  secret: "matche_secret_dev", // une clé secrète utilisée pour sécuriser le cookie
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // le cookie reste valable 24h
}));

// Nouveau : express.static sert directement les fichiers du dossier
// parent (Matche-projet), donc ton index.html est maintenant accessible
// via http://localhost:3000/ au lieu d'être ouvert en double-cliquant dessus.
app.use(express.static(path.join(__dirname, "..")));

// ---- Routes offres ----

app.get("/api/offres", function (requete, reponse) {
  const offres = db.prepare("SELECT * FROM offres").all();
  reponse.json(offres);
});

// Nouvelle route de test : recherche de vraies offres via l'API France Travail.
// "async function" ici aussi, car obtenirToken() et rechercherOffres()
// utilisent await à l'intérieur.
app.get("/api/offres-france-travail", async function (requete, reponse) {
  // requete.query contient les paramètres tapés après le "?" dans l'adresse
  // (ex: /api/offres-france-travail?motsCles=cuisinier)
  const motsCles = requete.query.motsCles || "développeur";

  try {
    const offres = await franceTravail.rechercherOffres(motsCles);
    reponse.json(offres);
  } catch (erreur) {
    console.error(erreur);
    reponse.status(500).json({ erreur: "Impossible de récupérer les offres depuis France Travail." });
  }
});

app.post("/api/offres", function (requete, reponse) {

  // Nouveau : vérification de sécurité CÔTÉ SERVEUR.
  // Cacher juste le formulaire sur la page ne suffirait pas : n'importe qui
  // pourrait quand même envoyer une requête POST directement (avec un outil
  // comme Postman, ou même la console du navigateur). Il faut vérifier ici,
  // sur le serveur, qui ne peut pas être contourné depuis l'extérieur.
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "entreprise") {
    // .status(403) = "Interdit" : la requête est comprise, mais refusée
    return reponse.status(403).json({ erreur: "Seules les entreprises connectées peuvent publier une offre." });
  }

  const { titre, entreprise, ville, contrat, salaire, salaireMoyen } = requete.body;

  const insererOffre = db.prepare(`
    INSERT INTO offres (titre, entreprise, ville, contrat, salaire, salaireMoyen)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const resultat = insererOffre.run(titre, entreprise, ville, contrat, salaire, salaireMoyen);

  reponse.json({
    id: resultat.lastInsertRowid,
    titre, entreprise, ville, contrat, salaire, salaireMoyen
  });
});

// ---- Inscription ----

app.post("/api/inscription", function (requete, reponse) {
  const { email, motDePasse, type, nom } = requete.body;

  if (!email || !motDePasse || !type || !nom) {
    return reponse.status(400).json({ erreur: "Tous les champs sont obligatoires." });
  }

  const motDePasseHache = bcrypt.hashSync(motDePasse, 10);

  try {
    const insererUtilisateur = db.prepare(`
      INSERT INTO utilisateurs (email, motDePasseHache, type, nom)
      VALUES (?, ?, ?, ?)
    `);

    const resultat = insererUtilisateur.run(email, motDePasseHache, type, nom);

    reponse.json({
      id: resultat.lastInsertRowid,
      email, type, nom
    });

  } catch (erreur) {
    reponse.status(400).json({ erreur: "Cet email est déjà utilisé." });
  }
});

// ---- Connexion ----

app.post("/api/connexion", function (requete, reponse) {
  const { email, motDePasse } = requete.body;

  if (!email || !motDePasse) {
    return reponse.status(400).json({ erreur: "Email et mot de passe obligatoires." });
  }

  const utilisateur = db.prepare("SELECT * FROM utilisateurs WHERE email = ?").get(email);

  if (!utilisateur) {
    return reponse.status(401).json({ erreur: "Email ou mot de passe incorrect." });
  }

  const motDePasseCorrect = bcrypt.compareSync(motDePasse, utilisateur.motDePasseHache);

  if (!motDePasseCorrect) {
    return reponse.status(401).json({ erreur: "Email ou mot de passe incorrect." });
  }

  // Nouveau : on enregistre l'utilisateur dans la session.
  // req.session se comporte comme un objet normal, mais son contenu est
  // conservé côté serveur et lié au cookie envoyé au navigateur.
  requete.session.utilisateur = {
    id: utilisateur.id,
    nom: utilisateur.nom,
    email: utilisateur.email,
    type: utilisateur.type
  };

  reponse.json(requete.session.utilisateur);
});

// Nouveau : cette route permet à la page de demander
// "au fait, est-ce que quelqu'un est déjà connecté ?" — utile juste après
// un rechargement de page, quand la mémoire JavaScript a été vidée
// mais que le cookie de session, lui, est toujours là.
app.get("/api/moi", function (requete, reponse) {
  if (requete.session.utilisateur) {
    reponse.json(requete.session.utilisateur);
  } else {
    reponse.status(401).json({ erreur: "Non connecté." });
  }
});

// Nouveau : déconnexion, qui détruit la session côté serveur
app.post("/api/deconnexion", function (requete, reponse) {
  requete.session.destroy(function () {
    reponse.json({ message: "Déconnecté." });
  });
});

const PORT = 3000;
app.listen(PORT, function () {
  console.log("Serveur démarré sur http://localhost:" + PORT);
});
