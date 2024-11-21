import { normalize } from '../Utils.js';

export function computeBeneficiaireQualite (beneficiaire) {
    if (!beneficiaire) {
        return '';
    }

    if (beneficiaire.beneficiaire_representant_legal) {
        return 'Bénéficiaire représentant légal';
    }

    const types = [
        beneficiaire.pourcentage_parts_directes || beneficiaire.pourcentage_votes_directs ? 'direct' : '',
        beneficiaire.pourcentage_parts_indirectes || beneficiaire.pourcentage_votes_indirect ? 'indirect' : '',
        beneficiaire.pourcentage_parts_vocation_titulaire ? 'vocation titulaire' : ''
    ].filter(x => x);

    return `Bénéficiaire ${types.join(' ')}`;
}

export function formatBeneficiaire (beneficiaire) {
    if (!beneficiaire) {
        return beneficiaire;
    }

    for (const [key, value] of Object.entries(beneficiaire)) {
        if (typeof value === 'string') {
            beneficiaire[key] = normalize(value).toUpperCase();
        }
    }

    beneficiaire.prenom = beneficiaire.prenom_usuel || beneficiaire.prenom || '';
    beneficiaire.prenom = beneficiaire.prenom.replace(/,|"/g, '').split(' ').shift();
    if (beneficiaire.prenom.endsWith('-')) {
        beneficiaire.prenom = beneficiaire.prenom.replace('-', '');
    }

    beneficiaire.adresse_ligne_1 = beneficiaire.adresse_ligne_1?.replace(/,|"/g, '') || null;
    beneficiaire.adresse_ligne_2 = beneficiaire.adresse_ligne_2?.replace(/,|"/g, '') || null;
    beneficiaire.adresse_ligne_3 = beneficiaire.adresse_ligne_3?.replace(/,|"/g, '') || null;

    if (beneficiaire.code_postal === '.') {
        beneficiaire.code_postal = '';
    }

    beneficiaire.nationalite = beneficiaire.code_nationalite;
    beneficiaire.pays = beneficiaire.code_pays;


    return beneficiaire;
}