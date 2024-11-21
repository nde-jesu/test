import { parse } from 'csv-parse';
import fs from 'fs';
import iconv from '../node_modules/iconv-lite/lib/index.js';

export default class CsvReader {
    constructor(options = {}, headerReplacements = {}) {
        this.options = options;
        this.headerReplacements = headerReplacements;
    }

    loadFile(path, newLineCallback, optionRead = {}) {
        this.parser = parse(this.options);

        let headers = null;
        return new Promise((resolve, reject) => {
            this.parser.on('data', async record => {
                this.parser.pause();
                if (!headers) {
                    headers = record;

                    headers = headers.map((h, i) => {
                        const headerCount = headers.slice(0, i).filter(x => x === h).length;
                        h = this.options.trimHeader ? h.trim() : h;
                        return !headerCount ? h : `${h}_${headerCount}`;
                    });

                    headers = headers.map(h => {
                        if (h in this.headerReplacements) {
                            return this.headerReplacements[h];
                        }
                        return h;
                    });
                } else {
                    const object = Object.fromEntries(headers.map((h, index) => [h, record[index]]));
                    try {
                        await newLineCallback(object);
                    } catch (error) {
                        return reject(error);
                    }
                }
                this.parser.resume();
            });
            this.parser.on('error', function(err) {
                reject(err);
            });
            this.parser.on('end', function() {
                resolve();
            });

            const readStream = fs.createReadStream(path, optionRead);
            readStream
                .pipe(iconv.decodeStream('UTF-8'))
                .pipe(this.parser);
        });
    }
}
