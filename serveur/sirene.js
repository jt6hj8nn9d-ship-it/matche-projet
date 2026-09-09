// sirene.js
// Vérifie qu'un numéro SIRET correspond bien à une vraie entreprise,
// en interrogeant l'API officielle et gratuite du gouvernement.
// Aucune clé n'est nécessaire pour cette API (contrairement à France Travail).

async function verifierSiret(siret) {

  // Un SIRET fait toujours exactement 14 chiffres.
  // On vérifie ce format AVANT d'appeler l'API, pour ne pas gaspiller
  // un appel réseau sur une saisie manifestement incorrecte.
  if (!/^\d{14}$/.test(siret)) {
    return { valide: false, raison: "Le SIRET doit contenir exactement 14 chiffres." };
  }

  const url = "https://recherche-entreprises.api.gouv.fr/search?q=" + siret;

  const reponse = await fetch(url);
  const donnees = await reponse.json();

  if (!donnees.results || donnees.results.length === 0) {
    return { valide: false, raison: "Aucune entreprise trouvée avec ce SIRET." };
  }

  // Parmi les résultats, on cherche l'établissement dont le SIRET
  // correspond EXACTEMENT à celui saisi (la recherche peut renvoyer
  // plusieurs établissements d'une même entreprise, par exemple si
  // elle a plusieurs sites).
  for (const resultat of donnees.results) {
    const etablissements = resultat.matching_etablissements || [];

    const etablissementTrouve = etablissements.find(function (etab) {
      return etab.siret === siret;
    });

    if (etablissementTrouve || (resultat.siege && resultat.siege.siret === siret)) {
      return {
        valide: true,
        nomEntreprise: resultat.nom_complet || resultat.nom_raison_sociale,
        siret: siret
      };
    }
  }

  return { valide: false, raison: "Ce SIRET ne correspond à aucun établissement actif." };
}

module.exports = { verifierSiret };
