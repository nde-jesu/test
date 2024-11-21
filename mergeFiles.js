// Script pour fusionner 2 fichiers en prenant le SIREN comme base

import CsvReader from '../shared/classes/CsvReader.js';
import CsvWriter from '../shared/classes/CsvWriter.js';

const sourceFile = 'part2.csv';
const addFile = 'export.csv';

const reader = new CsvReader();
const writer = new CsvWriter('./part2_merge.csv');

const source = {};

async function main () {
    await reader.loadFile(addFile, line => {
        source[line.siren] = line;
    });

    await reader.loadFile(sourceFile, line => {
        const toAdd = source?.[line.siren];
        writer.newLine(toAdd || line);
    });
}

main();