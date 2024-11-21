import fs from 'fs';
import moment from 'moment';
import CsvReader from '../shared/classes/CsvReader.js';
import BeneficiairesDownloader from './beneficiaireDownloader.js';

const beneficiaires = new BeneficiairesDownloader();

const reader = new CsvReader();

let totalPasFullAdresses = [];
const pasTrouve = [];

async function main () {
    await reader.loadFile('./part_1.csv', async line => {
        if (line['Trouvée'] === 'Non') {
            try {
                const { status } = await beneficiaires.requêteEntreprise(line.siren, false);
                pasTrouve.push(line.siren);
            } catch (e) {
            }
        }

        for (const [key, value] of Object.entries(line)) {
            if (key.includes('Date de naissance') && value && !moment(value, 'DD/MM/YYYY').isValid()) {
                totalPasFullAdresses.push(line.siren);
            }
        }
    });

    fs.writeFileSync('./erreur', [...new Set(pasTrouve)].join('\n'));
    fs.writeFileSync('./manquante', [...new Set(totalPasFullAdresses)].join('\n'));
}

main();