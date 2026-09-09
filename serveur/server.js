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
const { verifierSiret } = require("./sirene");

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

  const { titre, entreprise, ville, contrat, salaire, salaireMoyen, description, experience, teletravail } = requete.body;

  const insererOffre = db.prepare(`
    INSERT INTO offres (titre, entreprise, ville, contrat, salaire, salaireMoyen, utilisateurId, description, experience, teletravail, dateCreation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // new Date().toISOString() donne la date et l'heure actuelles dans un format standard,
  // enregistrées automatiquement au moment de la publication
  const resultat = insererOffre.run(
    titre, entreprise, ville, contrat, salaire, salaireMoyen,
    requete.session.utilisateur.id, description || "", experience || "", teletravail || "",
    new Date().toISOString()
  );

  reponse.json({
    id: resultat.lastInsertRowid,
    titre, entreprise, ville, contrat, salaire, salaireMoyen
  });
});

// ---- Inscription ----

app.post("/api/inscription", async function (requete, reponse) {
  const { email, motDePasse, type, nom, siret } = requete.body;

  if (!email || !motDePasse || !type || !nom) {
    return reponse.status(400).json({ erreur: "Tous les champs sont obligatoires." });
  }

  // Nouveau : pour un compte entreprise, le SIRET est obligatoire
  // et doit correspondre à une vraie entreprise
  let siretVerifie = null;

  if (type === "entreprise") {
    if (!siret) {
      return reponse.status(400).json({ erreur: "Le SIRET est obligatoire pour un compte entreprise." });
    }

    // "await" ici aussi : on attend la réponse de l'API gouvernementale
    // avant de continuer, comme pour France Travail
    const resultatVerification = await verifierSiret(siret);

    if (!resultatVerification.valide) {
      return reponse.status(400).json({ erreur: "SIRET invalide : " + resultatVerification.raison });
    }

    siretVerifie = resultatVerification.siret;
  }

  const motDePasseHache = bcrypt.hashSync(motDePasse, 10);

  try {
    const insererUtilisateur = db.prepare(`
      INSERT INTO utilisateurs (email, motDePasseHache, type, nom, siret)
      VALUES (?, ?, ?, ?, ?)
    `);

    const resultat = insererUtilisateur.run(email, motDePasseHache, type, nom, siretVerifie);

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

// Nouvelle route : swiper une offre (like ou pass)
app.post("/api/offres/:id/swipe", function (requete, reponse) {

  // Seul un candidat connecté peut swiper
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "candidat") {
    return reponse.status(403).json({ erreur: "Connecte-toi en tant que candidat pour swiper." });
  }

  const offreId = requete.params.id; // vient de l'adresse (ex: /api/offres/3/swipe)
  const { direction } = requete.body; // "like" ou "pass"

  if (direction !== "like" && direction !== "pass") {
    return reponse.status(400).json({ erreur: "Direction invalide." });
  }

  // INSERT ... ON CONFLICT : insère normalement, mais si la contrainte UNIQUE
  // est violée (déjà swipé cette offre), met à jour la ligne existante à la place
  const enregistrerSwipe = db.prepare(`
    INSERT INTO likes (utilisateurId, offreId, direction)
    VALUES (?, ?, ?)
    ON CONFLICT(utilisateurId, offreId) DO UPDATE SET direction = excluded.direction
  `);

  enregistrerSwipe.run(requete.session.utilisateur.id, offreId, direction);

  reponse.json({ message: "Swipe enregistré." });
});

// Nouvelle route : les offres que le candidat connecté a likées
app.get("/api/mes-likes", function (requete, reponse) {
  if (!requete.session.utilisateur) {
    return reponse.status(401).json({ erreur: "Non connecté." });
  }

  // JOIN : on combine la table "likes" et la table "offres" pour récupérer
  // directement les informations complètes des offres likées, en une seule requête
  const offresLikees = db.prepare(`
    SELECT offres.* FROM offres
    JOIN likes ON likes.offreId = offres.id
    WHERE likes.utilisateurId = ? AND likes.direction = 'like'
  `).all(requete.session.utilisateur.id);

  reponse.json(offresLikees);
});

const PORT = 3000;

// ---- Côté entreprise : gérer ses propres offres ----

app.get("/api/mes-offres", function (requete, reponse) {
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "entreprise") {
    return reponse.status(403).json({ erreur: "Réservé aux comptes entreprise." });
  }

  // Une "sous-requête" : pour chaque offre, on compte séparément combien de lignes
  // existent dans "likes" avec direction='like' et le même offreId. Ça donne
  // le nombre de likes directement dans le résultat, sans requête à part.
  const mesOffres = db.prepare(`
    SELECT offres.*,
      (SELECT COUNT(*) FROM likes WHERE likes.offreId = offres.id AND likes.direction = 'like') AS nombreLikes,
      (SELECT COUNT(*) FROM vues_offres WHERE vues_offres.offreId = offres.id) AS nombreVues
    FROM offres
    WHERE utilisateurId = ?
    ORDER BY id DESC
  `).all(requete.session.utilisateur.id);

  reponse.json(mesOffres);
});

// Nouvelle route : enregistrer qu'un candidat a consulté une offre en détail.
// Grâce à ON CONFLICT DO NOTHING, revoir la même offre plusieurs fois
// n'ajoute pas de nouvelle vue : la contrainte UNIQUE bloque le doublon.
app.post("/api/offres/:id/vue", function (requete, reponse) {
  // On ne compte que les vues des candidats connectés (pas les visiteurs
  // anonymes, ni les entreprises qui regardent une offre d'un concurrent)
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "candidat") {
    return reponse.json({ message: "Vue non comptabilisée (non candidat)." });
  }

  db.prepare(`
    INSERT INTO vues_offres (candidatId, offreId)
    VALUES (?, ?)
    ON CONFLICT(candidatId, offreId) DO NOTHING
  `).run(requete.session.utilisateur.id, requete.params.id);

  reponse.json({ message: "Vue enregistrée." });
});

app.put("/api/offres/:id", function (requete, reponse) {
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "entreprise") {
    return reponse.status(403).json({ erreur: "Réservé aux comptes entreprise." });
  }

  const offreId = requete.params.id;

  // On vérifie que l'offre appartient bien à cette entreprise avant de la modifier
  const offre = db.prepare("SELECT * FROM offres WHERE id = ? AND utilisateurId = ?")
    .get(offreId, requete.session.utilisateur.id);

  if (!offre) {
    return reponse.status(403).json({ erreur: "Cette offre ne vous appartient pas." });
  }

  const { titre, entreprise, ville, contrat, salaire, salaireMoyen, description, experience, teletravail } = requete.body;

  const mettreAJour = db.prepare(`
    UPDATE offres
    SET titre = ?, entreprise = ?, ville = ?, contrat = ?, salaire = ?, salaireMoyen = ?,
        description = ?, experience = ?, teletravail = ?
    WHERE id = ?
  `);

  mettreAJour.run(
    titre, entreprise, ville, contrat, salaire, salaireMoyen,
    description || "", experience || "", teletravail || "",
    offreId
  );

  reponse.json({ message: "Offre mise à jour." });
});

app.delete("/api/offres/:id", function (requete, reponse) {
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "entreprise") {
    return reponse.status(403).json({ erreur: "Réservé aux comptes entreprise." });
  }

  const offreId = requete.params.id;

  const offre = db.prepare("SELECT * FROM offres WHERE id = ? AND utilisateurId = ?")
    .get(offreId, requete.session.utilisateur.id);

  if (!offre) {
    return reponse.status(403).json({ erreur: "Cette offre ne vous appartient pas." });
  }

  // On supprime aussi les likes et matchs liés à cette offre, pour ne pas
  // laisser de données "orphelines" en base (qui pointeraient vers une offre inexistante)
  db.prepare("DELETE FROM likes WHERE offreId = ?").run(offreId);
  db.prepare("DELETE FROM matchs WHERE offreId = ?").run(offreId);
  db.prepare("DELETE FROM offres WHERE id = ?").run(offreId);

  reponse.json({ message: "Offre supprimée." });
});

// ---- Côté entreprise : voir qui a liké mes offres ----

app.get("/api/candidats-interesses", function (requete, reponse) {
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "entreprise") {
    return reponse.status(403).json({ erreur: "Réservé aux comptes entreprise." });
  }

  // On récupère : l'offre likée, le candidat qui a liké, et si un match
  // existe déjà pour cette paire (grâce à un LEFT JOIN : on garde la ligne
  // même si aucun match ne correspond, contrairement à un JOIN normal)
  const candidats = db.prepare(`
    SELECT
      likes.offreId,
      offres.titre AS offreTitre,
      utilisateurs.id AS candidatId,
      utilisateurs.nom AS candidatNom,
      matchs.id AS matchExistant
    FROM likes
    JOIN offres ON offres.id = likes.offreId
    JOIN utilisateurs ON utilisateurs.id = likes.utilisateurId
    LEFT JOIN matchs ON matchs.offreId = likes.offreId AND matchs.candidatId = likes.utilisateurId
    WHERE offres.utilisateurId = ? AND likes.direction = 'like'
  `).all(requete.session.utilisateur.id);

  reponse.json(candidats);
});

// ---- Côté entreprise : confirmer l'intérêt pour un candidat (= créer le match) ----

app.post("/api/matchs", function (requete, reponse) {
  if (!requete.session.utilisateur || requete.session.utilisateur.type !== "entreprise") {
    return reponse.status(403).json({ erreur: "Réservé aux comptes entreprise." });
  }

  const { candidatId, offreId } = requete.body;

  // Vérification de sécurité : l'entreprise ne peut confirmer un match
  // que sur SES PROPRES offres, pas celles d'une autre entreprise
  const offre = db.prepare("SELECT * FROM offres WHERE id = ? AND utilisateurId = ?")
    .get(offreId, requete.session.utilisateur.id);

  if (!offre) {
    return reponse.status(403).json({ erreur: "Cette offre ne vous appartient pas." });
  }

  const creerMatch = db.prepare(`
    INSERT INTO matchs (candidatId, offreId)
    VALUES (?, ?)
    ON CONFLICT(candidatId, offreId) DO NOTHING
  `);

  creerMatch.run(candidatId, offreId);

  reponse.json({ message: "Match confirmé !" });
});

// ---- Côté candidat : mes matchs confirmés ----

app.get("/api/mes-matchs", function (requete, reponse) {
  if (!requete.session.utilisateur) {
    return reponse.status(401).json({ erreur: "Non connecté." });
  }

  const matchs = db.prepare(`
    SELECT offres.* FROM matchs
    JOIN offres ON offres.id = matchs.offreId
    WHERE matchs.candidatId = ?
  `).all(requete.session.utilisateur.id);

  reponse.json(matchs);
});
app.listen(PORT, function () {
  console.log("Serveur démarré sur http://localhost:" + PORT);
});
