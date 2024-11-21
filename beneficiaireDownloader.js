// On veut plusieurs étapes possibles
// 1) Faire une requête entreprise classique -> On vérifie si les bénéficiaires existent, et si leur date de naissance sont déjà remplies grace aux représentants
// 2) Si non, on fait une requête avec les full_benefs, en utilisant les diférents comptes inpi (permettre d'envoyer en query le token inpi_be via le rne-server)
// Faut penser à vérifier au retour si on a bien les données complètes (via le code 206 ou regarder la date de naissance complète), sinon passer au compte suivant
// 3)Quand tous les comptes sont épuisés, il faut que le script se mette en pause / s'arrête, et teste régulièrement (1 fois par heure) si jamais un des compte est reset

// Il faut prévoir un failsafe, si jamais le script se coupe, on doit pouvoir le relancer et qu'il reprenne où on en était.
// Aussi il faut garder en mémoire toutes les données le temps du script

import axios from 'axios';
import moment from 'moment';
import fs from 'fs';
import dotenv from 'dotenv';

import { encrypt } from '../shared/utils/commons.js';

dotenv.config({ path: '../.env' });

import comptesRbe from './comptesRbe.js';

export default class BeneficiairesDownloader {
    constructor ({ resetCacheForSiren = [] } = {}) {
        this.#populateAccounts();
        this.waiting = null;

        if (resetCacheForSiren.length) {
            this.#resetCache(resetCacheForSiren);
        }
    }

    // Gestion des caches

    #resetCache (sirens) {
        for (const siren of sirens) {
            this.#deleteFromCache(siren);
        }
    }

    #deleteFromCache (siren) {
        try {
            fs.unlinkSync(`./beneficiaire-data-cache/${siren}.json`);
        } catch (e) {}
    }

    #saveEntreprise (entreprise, siren) {
        fs.writeFileSync(`./beneficiaire-data-cache/${siren}.json`, JSON.stringify(entreprise, null, 4));
    }

    #getCachedEntreprise (siren) {
        try {
            const entreprise = JSON.parse(fs.readFileSync(`./beneficiaire-data-cache/${siren}.json`));
            console.log(`Récupération de données sur le siren ${siren} sur le cache`);
            return entreprise;
        } catch (e) {
            // console.error(e);
        }
    }

    // Gestion des comptes RBE

    #populateAccounts () {
        this.comptesDisponibles = comptesRbe.map(compte => {
            return { ...compte, down: false };
        });
    }

    async #getRbeAccount () {
        const account = this.comptesDisponibles.find(compte => !compte.down);

        if (account) {
            return account;
        }

        console.log('Plus de compte RBE, attente');
        this.#waitForAccountsReset();
        await this.waiting;

        return this.#getRbeAccount();
    }

    #waitForAccountsReset () {
        if (this.waiting) {
            return;
        }

        this.waiting = new Promise(resolve => {
            setTimeout(() => {
                this.waiting = null;
                this.#populateAccounts();
                console.log("Fin de l'attente");
                return resolve();
            }, 60 * 60 * 1000);
        });
    }

    // Utils

    #areFullBeneficiaires (beneficiaires) {
        return beneficiaires?.every(beneficiaire => moment(beneficiaire.date_de_naissance_complete_formatee, 'DD/MM/YYYY', true).isValid());
    }

    // Gestion de la requête

    async requêteEntreprise (siren, rbeAccount = false) {
        const { data: entreprise, status } = await axios.get(`${process.env.RNES_URL}/entreprise`, {
            params: {
                siren,
                onlyCache: true,
                ...rbeAccount ? {
                    i_be_token: encrypt(`${rbeAccount.login}&${rbeAccount.password}`)
                } : {}
            },
            headers: {
                'access-token': process.env.ACCESS_TOKEN
            }
        });

        return { entreprise, status };
    }

    async requêteApiPappers (siren, rbeAccount = false) {
        try {
            const { data: entreprise, status } = await axios.get(`${process.env.API_URL}/entreprise`, {
                params: {
                    siren,
                    onlyCache: true,
                    api_token: process.env.API_TOKEN,
                    erreur_si_incomplet: true,
                    ...rbeAccount ? { i_be_token: encrypt(`${rbeAccount.login}&${rbeAccount.password}`), beneficiaires_effectifs_complets: 1 } : {}
                },
            });
            
            return { entreprise, status };
        } catch (e) {
            if (e?.response?.status === 404) {
                return { entreprise: null, status: 404 };
            }
            throw e;
        }
    }

    async #getEntreprise (siren, useRbeAccount = true, tries = 1) {
        const rbeAccount = useRbeAccount ? await this.#getRbeAccount() : null;

        try {
            console.log(`Récupération de ${siren} ${useRbeAccount ? 'avec les bénéficiaires complets' : ''}`);
            const { entreprise, status } = await this.requêteApiPappers(siren, rbeAccount);

            if (!entreprise && status === 404) {
                return null;
            }

            if (this.#areFullBeneficiaires(entreprise.beneficiaires_effectifs)) {
                return entreprise;
            }

            if (tries <= 3) {
                return await this.#getEntreprise(siren, true, ++tries, entreprise);
            }

            if (useRbeAccount) {
                // Si on arrive ici c'est que les données sont pas complètes, mais que ça vient du RNE qui n'a pas les infos. On les écrit quand même pour avoir des données
                fs.appendFileSync('./sirensIncomplets', siren + '\n');
            }

            return entreprise;
        } catch (e) {
            console.error(`Impossible de récupérer les données entreprise pour le siren ${siren}`);
            throw e;
        }
    }

    async getBeneficiaires (siren) {
        const cache = this.#getCachedEntreprise(siren);
        if (cache && this.#areFullBeneficiaires(cache.beneficiaires_effectifs)) {
            return cache;
        }

        if (cache) { // ICI ÇA VEUT DIRE QUE LE CACHE A ÉTÉ ENREGISTRÉ NON COMPLET
            this.#deleteFromCache(siren);
        }

        const entreprise = await this.#getEntreprise(siren);

        if (entreprise) {
            this.#saveEntreprise(entreprise, siren);
        }

        return entreprise;
    }
}