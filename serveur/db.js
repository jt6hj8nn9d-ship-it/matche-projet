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
    salaireMoyen INTEGER NOT NULL
  )
`);
// Traduction de ces lignes :
// - id : un numéro unique attribué automatiquement à chaque offre (AUTOINCREMENT)
// - les autres colonnes : le type de donnée attendu (TEXT = texte, INTEGER = nombre entier)
// - NOT NULL : cette information est obligatoire, jamais vide

// On vérifie combien d'offres existent déjà dans la table
const nombreOffres = db.prepare("SELECT COUNT(*) AS total FROM offres").get().total;

// Si la table est vide (première fois qu'on lance le serveur), on la remplit
if (nombreOffres === 0) {

  // db.prepare(...) prépare une commande SQL réutilisable.
  // Les "?" sont des emplacements réservés : on donne les vraies valeurs juste après,
  // via .run(...). C'est plus sûr que d'insérer du texte directement dans la requête.
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
