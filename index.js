// Scipt permettant à partir d'une liste de SIRENs de récupérer un CSV avec par ligne, les 50 premiers bénéficiaires effectifs de l'entreprise et toutes leurs données.

/**
 * Deux choses à modifier sur pappers-engine :
 * Passer le nombre de lignes récupérées de 1000 à 2000 (remplacer tous les 1000 de recherche.js à 2000)
 * Passer le timeout du SireneSource.js à 15000
 * Lancer l'api en local avec SS, RCSS et SRNS en local (SS pour l'export excel à faire sur insomnia)
 */

import fs from 'fs';
import 'log-timestamp';
import moment from 'moment';
import CsvWriter from '../shared/classes/CsvWriter.js';
import BeneficiairesDownloader from './beneficiaireDownloader.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { normalize } from '../Utils.js';
import { formatBeneficiaire, computeBeneficiaireQualite } from './utils.js';

const sirens = fs.readFileSync('input.txt').toString('utf-8').split('\n');

const csv = new CsvWriter('export.csv');
const beneficiaires = new BeneficiairesDownloader();

async function getBeneficiaire (siren) {
    let entreprise;

    const object = {
        siren,
        'Trouvée': 'Oui'
    };

    try {
        entreprise = await beneficiaires.getBeneficiaires(siren);
    } catch (e) {
        console.log(`L'entreprise ${siren} est introuvable`);
        // Sur ce fichier peut se trouver soit des sirens dont on a vraiment rien, soit des sirens sur lesquels la requête a échoué. Il faut donc en fin de script relancer plusieurs fois sur cette liste jusqu'a ce qu'on ne puisse plus reduire le nombre d'erreur
        fs.writeFileSync('erreurBE', `${siren}\n`, { flag: 'a' });
        object['Trouvée'] = 'Non';
    }

    if (!entreprise) {
        return;
    }

    for (let i = 0; i < 50; i++) {
        const beneficiaire = formatBeneficiaire(entreprise?.beneficiaires_effectifs?.[i]);

        object[`UBO ${i + 1} - Qualité`] = normalize(computeBeneficiaireQualite(beneficiaire)).toUpperCase();
        object[`UBO ${i + 1} - Nom`] = beneficiaire?.nom || '';
        object[`UBO ${i + 1} - Nom usage`] = beneficiaire?.nom_usage || '';
        object[`UBO ${i + 1} - Prénom`] = beneficiaire?.prenom || '';
        object[`UBO ${i + 1} - Sexe`] = beneficiaire?.sexe || '';
        object[`UBO ${i + 1} - Adresse Ligne 1`] = beneficiaire?.adresse_ligne_1 || '';
        object[`UBO ${i + 1} - Adresse Ligne 2`] = beneficiaire?.adresse_ligne_2 || '';
        object[`UBO ${i + 1} - Adresse Ligne 3`] = beneficiaire?.adresse_ligne_3 || '';
        object[`UBO ${i + 1} - Code Postal`] = beneficiaire?.code_postal || '';
        object[`UBO ${i + 1} - Ville`] = beneficiaire?.ville || '';
        object[`UBO ${i + 1} - Date de naissance`] = beneficiaire?.date_de_naissance_complete_formatee || beneficiaire?.date_de_naissance_formatee ||'';
        
        if (beneficiaire?.date_de_naissance_complete_formatee) {
            object[`UBO ${i + 1} - Âge`] = moment().diff(moment(beneficiaire.date_de_naissance_complete_formatee, 'DD/MM/YYYY'), 'years');
        } else {
            object[`UBO ${i + 1} - Âge`] = beneficiaire?.date_de_naissance_formatee ? moment().diff(moment(beneficiaire.date_de_naissance_formatee, 'MM/YYYY'), 'years') : '';
        }

        object[`UBO ${i + 1} - Nationalité`] = beneficiaire?.nationalite || '';
        object[`UBO ${i + 1} - Pays de résidence`] = beneficiaire?.pays || '';
        object[`UBO ${i + 1} - % droit de vote`] = beneficiaire?.pourcentage_votes || '';
        object[`UBO ${i + 1} - % des parts`] = beneficiaire?.pourcentage_parts || '';

        if (beneficiaire) {
            object[`UBO ${i + 1} - Détention pouvoir décision en Assemblée Générale`] = beneficiaire?.detention_pouvoir_decision_ag ? 'Oui' : 'Non';
            object[`UBO ${i + 1} - Détention pouvoir nom membre conseil administration`] = beneficiaire?.detention_pouvoir_nom_membre_conseil_administration ? 'Oui' : 'Non';
            object[`UBO ${i + 1} - Détention autre moyen de contrôle`] = beneficiaire?.detention_autres_moyens_controle ? 'Oui' : 'Non';
            object[`UBO ${i + 1} - Bénéficiaire représentant légal`] = beneficiaire?.beneficiaire_representant_legal ? 'Oui' : 'Non';
        } else {
            object[`UBO ${i + 1} - Détention pouvoir décision en Assemblée Générale`] = '';
            object[`UBO ${i + 1} - Détention pouvoir nom membre conseil administration`] = '';
            object[`UBO ${i + 1} - Détention autre moyen de contrôle`] = '';
            object[`UBO ${i + 1} - Bénéficiaire représentant légal`] = '';
        }
    }

    csv.newLine(object);
}

async function main () {
    for (const siren of sirens) {
        console.log(`Traitement de ${siren}`);
        await getBeneficiaire(siren);
    }

    await csv.end();
    console.log('Terminé');
}

main();