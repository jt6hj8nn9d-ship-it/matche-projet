// server.js

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ---- Routes offres (déjà existantes) ----

app.get("/api/offres", function (requete, reponse) {
  const offres = db.prepare("SELECT * FROM offres").all();
  reponse.json(offres);
});

app.post("/api/offres", function (requete, reponse) {
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

// ---- Nouvelle route : inscription ----

app.post("/api/inscription", function (requete, reponse) {
  const { email, motDePasse, type, nom } = requete.body;

  // Vérification simple : on refuse si un champ obligatoire manque
  if (!email || !motDePasse || !type || !nom) {
    // .status(400) = "requête incorrecte", un code d'erreur HTTP standard
    return reponse.status(400).json({ erreur: "Tous les champs sont obligatoires." });
  }

  // bcrypt.hashSync(motDePasse, 10) transforme le mot de passe en texte illisible.
  // Le "10" est le niveau de complexité du hachage (plus c'est haut, plus c'est
  // lent à calculer, donc plus dur à casser par un attaquant). 10 est un bon défaut.
  const motDePasseHache = bcrypt.hashSync(motDePasse, 10);

  try {
    const insererUtilisateur = db.prepare(`
      INSERT INTO utilisateurs (email, motDePasseHache, type, nom)
      VALUES (?, ?, ?, ?)
    `);

    const resultat = insererUtilisateur.run(email, motDePasseHache, type, nom);

    // On ne renvoie JAMAIS le mot de passe (même haché) dans la réponse
    reponse.json({
      id: resultat.lastInsertRowid,
      email, type, nom
    });

  } catch (erreur) {
    // Si l'email existe déjà, la contrainte UNIQUE de la base déclenche une erreur ici
    reponse.status(400).json({ erreur: "Cet email est déjà utilisé." });
  }
});

// ---- Nouvelle route : connexion ----

app.post("/api/connexion", function (requete, reponse) {
  const { email, motDePasse } = requete.body;

  if (!email || !motDePasse) {
    return reponse.status(400).json({ erreur: "Email et mot de passe obligatoires." });
  }

  // On cherche un utilisateur avec cet email. .get() renvoie une seule ligne
  // (ou "undefined" si aucune ne correspond), contrairement à .all()
  const utilisateur = db.prepare("SELECT * FROM utilisateurs WHERE email = ?").get(email);

  if (!utilisateur) {
    // Message volontairement vague ("email OU mot de passe") plutôt que
    // "cet email n'existe pas" : ça évite de révéler à un attaquant
    // quels emails sont inscrits ou non.
    return reponse.status(401).json({ erreur: "Email ou mot de passe incorrect." });
  }

  // bcrypt.compareSync(motDePasseTapé, hachageStocké) renvoie true/false.
  // On ne "déchiffre" jamais le hachage : on hache le mot de passe tapé
  // à la volée et on compare les deux hachages entre eux.
  const motDePasseCorrect = bcrypt.compareSync(motDePasse, utilisateur.motDePasseHache);

  if (!motDePasseCorrect) {
    return reponse.status(401).json({ erreur: "Email ou mot de passe incorrect." });
  }

  // Connexion réussie : on renvoie les infos utiles, JAMAIS le mot de passe haché
  reponse.json({
    id: utilisateur.id,
    nom: utilisateur.nom,
    email: utilisateur.email,
    type: utilisateur.type
  });
});

const PORT = 3000;
app.listen(PORT, function () {
  console.log("Serveur démarré sur http://localhost:" + PORT);
});
