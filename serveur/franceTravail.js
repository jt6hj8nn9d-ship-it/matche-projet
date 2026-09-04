// franceTravail.js
// Ce fichier regroupe tout ce qui concerne la communication avec l'API
// France Travail : d'abord s'authentifier, puis chercher des offres.

// Ces deux valeurs viennent du fichier .env (jamais écrites en dur ici,
// jamais envoyées sur GitHub). process.env est un objet spécial fourni par
// Node.js qui contient les "variables d'environnement" de la machine,
// dont celles chargées depuis .env grâce à require("dotenv").config()
// (fait dans server.js).
const CLIENT_ID = process.env.FRANCE_TRAVAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

// ---- Étape 1 : obtenir un jeton d'accès (token) ----
//
// France Travail ne laisse pas interroger directement les offres avec
// client_id/client_secret. Il faut d'abord les échanger contre un "jeton"
// temporaire (valable environ 1h), qu'on utilisera ensuite pour chaque
// vraie requête. C'est le protocole standard OAuth2 "Client Credentials",
// utilisé par énormément d'API professionnelles.
//
// "async function" + "await" : une autre façon d'écrire du code qui attend
// une réponse, plus lisible que les chaînes de .then(). "await" veut dire
// "attends que cette étape soit terminée avant de continuer à la ligne suivante".
async function obtenirToken() {
  const url = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";

  // Les API OAuth2 attendent souvent ces informations au format
  // "x-www-form-urlencoded" plutôt qu'en JSON. URLSearchParams construit
  // ce format automatiquement à partir d'un objet.
  const corps = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "api_offresdemploiv2 o2dsoffre"
  });

  const reponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corps
  });

  // Nouveau : on lit d'abord la réponse comme du texte brut, pas directement
  // comme du JSON. Ça permet d'afficher le vrai contenu (même si ce n'est
  // pas du JSON valide, comme une page d'erreur en XML ou en HTML),
  // au lieu d'un message vague "Unexpected token".
  const texteBrut = await reponse.text();

  if (!reponse.ok) {
    throw new Error(
      "Erreur HTTP " + reponse.status + " lors de l'obtention du jeton : " + texteBrut
    );
  }

  const donnees = JSON.parse(texteBrut);

  if (!donnees.access_token) {
    throw new Error("Impossible d'obtenir un jeton France Travail : " + JSON.stringify(donnees));
  }

  return donnees.access_token;
}

// ---- Étape 2 : chercher des offres, en utilisant le jeton ----

async function rechercherOffres(motsCles) {
  const token = await obtenirToken();

  const url = new URL("https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search");
  url.searchParams.set("motsCles", motsCles);

  const reponse = await fetch(url, {
    headers: {
      // Le jeton se transmet dans un en-tête "Authorization",
      // précédé du mot "Bearer" (convention standard OAuth2)
      Authorization: "Bearer " + token
    }
  });

  const texteBrut = await reponse.text();

  if (!reponse.ok) {
    throw new Error(
      "Erreur HTTP " + reponse.status + " lors de la recherche d'offres : " + texteBrut
    );
  }

  const donnees = JSON.parse(texteBrut);

  // L'API renvoie les offres dans une propriété "resultats".
  // Si jamais elle est absente (aucun résultat), on renvoie un tableau vide
  // plutôt que de planter.
  return donnees.resultats || [];
}

module.exports = { rechercherOffres };
