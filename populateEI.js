// Ce script sert à ajouter les bénéficiaires pour les cas d'Entreprise Individuelle (vu qu'on créé le BE depuis l'api et pas le RNES), il faut penser à consolider le bénéficiaire de l'api à partir du représentant si il existe
import moment from 'moment';

import CsvReader from '../shared/classes/CsvReader.js';
import CsvWriter from '../shared/classes/CsvWriter.js';
import ParallelWork from '../shared/classes/ParallelWork.js';

import { normalize } from '../Utils.js';
import { formatBeneficiaire, computeBeneficiaireQualite } from './utils.js';

import BeneficiairesDownloader from './beneficiaireDownloader.js';

const reader = new CsvReader();
const writer = new CsvWriter('./withEI.csv', {}, true);
const parallel = new ParallelWork(5);

const downloader = new BeneficiairesDownloader();

const fileToPopulate = './part1.csv';

const sirensWithoutBE = [];

function writeBeneficiaires (siren, beneficiaires) {
    const object = {
        siren,
        'Trouvée': 'Oui'
    };

    for (let i = 0; i < 20; i++) {
        const beneficiaire = formatBeneficiaire(beneficiaires?.[i]);

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

    writer.newLine(object);
}

function formatBeneficiairesWithRepresentants (beneficiaires, representants) {
    if (!beneficiaires.length) {
        return [];
    }

    for (const beneficiaire of beneficiaires) {
        const representantAssocie = findBeneficiaireInRepresentants(representants, beneficiaire);
        if (!representantAssocie) {
            continue;
        }

        beneficiaire.date_de_naissance_complete_formatee = beneficiaire.date_de_naissance_complete_formatee || representantAssocie.date_de_naissance_formate;
        beneficiaire.nationalite = beneficiaire.nationalite || representantAssocie.nationalite;
        beneficiaire.code_nationalite = beneficiaire.code_nationalite || representantAssocie.code_nationalite;
        beneficiaire.ville_de_naissance = beneficiaire.ville_de_naissance || representantAssocie.ville_de_naissance;
        beneficiaire.pays_de_naissance = beneficiaire.pays_de_naissance || representantAssocie.pays_de_naissance;
        beneficiaire.code_pays_de_naissance = beneficiaire.code_pays_de_naissance || representantAssocie.code_pays_de_naissance;
    }

    return beneficiaires;
}

function createNameIdentifier (prenoms, nom) {
    prenoms = normalize(prenoms)?.trim().replace(/,|-/g, ' ').replace(/ {2,}/g, ' ').split(' ')[0];
    nom = normalize(nom)?.trim();

    return `${prenoms ? `${prenoms} ` : ''}${nom} `;
}

function findBeneficiaireInRepresentants (representants, benef) {
    if (!representants || ((!benef.nom && !benef.nom_usage) || !benef.prenom || !benef.date_de_naissance_formatee)) {
        return null;
    }

    const identifierBenef = createNameIdentifier(benef.prenom, (benef.nom || benef.nom_usage)) + benef.date_de_naissance_formatee;
    return representants.find(rep => {
        // On doit pouvoir gérer le cas qui vient du retour INPI ou du retour MYSQL
        const dateNaissanceFormatee = rep.date_de_naissance_formate || (rep.date_naissance ? moment(rep.date_naissance).format('DD/MM/YYYY') : null);
        if ((!(rep.nom || rep.nom_patronymique) && !rep.nom_usage) || !(rep.prenom || rep.prenoms) || !dateNaissanceFormatee) {
            return false;
        }

        const identifierRep = createNameIdentifier((rep.prenom || rep.prenoms), (rep.nom || rep.nom_patronymique || rep.nom_usage)) + dateNaissanceFormatee.slice(3);
        return identifierBenef === identifierRep;
    });
}

async function getBeneficiaires (siren) {
    const { entreprise } = await downloader.requêteApiPappers(siren);

    const beneficiaires = formatBeneficiairesWithRepresentants(entreprise?.beneficiaires_effectifs || [], entreprise?.representants || []);
    writeBeneficiaires(siren, beneficiaires);
}

async function main () {
    const alreadyDoneSirens = [];

    await reader.loadFile('./withEi.csv', line => {
        alreadyDoneSirens.push(line.siren);
    });

    // On doit uniquement prendre les lignes où on a rien
    await reader.loadFile(fileToPopulate, line => {
        if (line['Trouvée'] === 'Oui' && !line['UBO 1 - Qualité'] && !alreadyDoneSirens.includes(line.siren)) {
            sirensWithoutBE.push(line.siren);
        }
    });

    for (const siren of sirensWithoutBE) {
        await parallel.run(() => getBeneficiaires(siren));
    }

    await parallel.finish();
    console.log('Parallel Terminé')
    await writer.end();
    console.log('Terminé')
}

main();