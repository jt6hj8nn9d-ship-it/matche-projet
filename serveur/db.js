// db.js
// Ce fichier s'occupe de tout ce qui concerne la base de données :
// la créer, définir sa structure, et la remplir une première fois.

const Database = require("better-sqlite3");

// new Database("matche.db") crée (ou ouvre si elle existe déjà) un fichier
// appelé matche.db dans ce dossier. C'est LÀ que vivent tes données,
// même si tu arrêtes et relances le serveur.
const db = new Database("matche.db");

// db.exec() exécute une commande SQL brute.
// CREATE TABLE IF NOT EXISTS = "crée cette table, sauf si elle existe déjà"
// (utile pour ne pas planter si tu relances le serveur plusieurs fois)
db.exec(`
  CREATE TABLE IF NOT EXISTS offres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    entreprise TEXT NOT NULL,
    ville TEXT NOT NULL,
    contrat TEXT NOT NULL,
    salaire TEXT NOT NULL,
    salaireMoyen INTEGER NOT NULL,
    utilisateurId INTEGER
  )
`);
// Nouveau : utilisateurId relie l'offre au compte entreprise qui l'a publiée.
// Peut être vide (NULL) pour les 5 offres de départ, qui n'appartiennent
// à aucun compte réel.

// Migration : si la base existait déjà avant l'ajout de cette colonne,
// on l'ajoute maintenant. Le try/catch évite une erreur si elle existe déjà
// (relance du serveur après la première migration).
try {
  db.exec("ALTER TABLE offres ADD COLUMN utilisateurId INTEGER");
} catch (erreur) {
  // La colonne existe déjà, rien à faire
}

// Nouvelle colonne : la description complète du poste (missions, profil recherché...),
// pour afficher une vraie fiche détaillée plutôt qu'un simple résumé
try {
  db.exec("ALTER TABLE offres ADD COLUMN description TEXT");
} catch (erreur) {
  // La colonne existe déjà, rien à faire
}

// Nouvelles colonnes : informations structurées supplémentaires pour la fiche détaillée
try {
  db.exec("ALTER TABLE offres ADD COLUMN experience TEXT");
} catch (erreur) {}

try {
  db.exec("ALTER TABLE offres ADD COLUMN teletravail TEXT");
} catch (erreur) {}

try {
  db.exec("ALTER TABLE offres ADD COLUMN dateCreation TEXT");
} catch (erreur) {}

// Nouveau : compteur de vues, initialisé à 0 pour toutes les offres existantes
try {
  db.exec("ALTER TABLE offres ADD COLUMN vues INTEGER DEFAULT 0");
} catch (erreur) {}

// Table dédiée pour compter les vues UNIQUES par candidat (un même candidat
// qui revoit 10 fois la même offre ne doit compter que pour 1 vue).
// Même principe que la table "likes" : UNIQUE(candidatId, offreId).
db.exec(`
  CREATE TABLE IF NOT EXISTS vues_offres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidatId INTEGER NOT NULL,
    offreId INTEGER NOT NULL,
    UNIQUE(candidatId, offreId)
  )
`);

// Nouvelle table : les utilisateurs (candidats ET entreprises, différenciés
// par la colonne "type").
// UNIQUE sur l'email : la base refusera automatiquement deux comptes avec
// le même email, sans qu'on ait à vérifier nous-mêmes à chaque fois.
db.exec(`
  CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    motDePasseHache TEXT NOT NULL,
    type TEXT NOT NULL,
    nom TEXT NOT NULL
  )
`);

// Nouvelle table : les likes/pass des candidats sur les offres.
// UNIQUE(utilisateurId, offreId) : un candidat ne peut avoir qu'UNE seule
// décision par offre (s'il swipe à nouveau, ça remplace l'ancienne, ça n'en crée pas une deuxième).
db.exec(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateurId INTEGER NOT NULL,
    offreId INTEGER NOT NULL,
    direction TEXT NOT NULL,
    UNIQUE(utilisateurId, offreId)
  )
`);

// Nouvelle table : les matchs confirmés (candidat a liké l'offre,
// ET l'entreprise a confirmé son intérêt pour ce candidat)
db.exec(`
  CREATE TABLE IF NOT EXISTS matchs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidatId INTEGER NOT NULL,
    offreId INTEGER NOT NULL,
    UNIQUE(candidatId, offreId)
  )
`);

// On vérifie combien d'offres existent déjà dans la table
const nombreOffres = db.prepare("SELECT COUNT(*) AS total FROM offres").get().total;

// Si la table est vide (première fois qu'on lance le serveur), on la remplit
if (nombreOffres === 0) {

  const insererOffre = db.prepare(`
    INSERT INTO offres (titre, entreprise, ville, contrat, salaire, salaireMoyen)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insererOffre.run("Développeuse Front-end React", "Ludovica Studio", "Bordeaux", "CDI", "38–45k€", 41);
  insererOffre.run("Chargé(e) de recrutement", "Aravis RH", "Lyon", "CDI", "32–36k€", 34);
  insererOffre.run("Cuisinier de collectivité", "Groupe Restauval", "Bayonne", "CDD 6 mois", "1 900€/mois", 23);
  insererOffre.run("Comptable fournisseurs", "Ferbois SA", "Toulouse", "CDI", "29–33k€", 31);
  insererOffre.run("Technicien de maintenance", "Atelier Voclain", "Pau", "CDI", "27–31k€", 29);

  console.log("Base de données initialisée avec 5 offres.");
}

// On exporte "db" pour pouvoir l'utiliser dans server.js
module.exports = db;
