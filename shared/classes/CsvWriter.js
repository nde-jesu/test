import fs from 'fs';
import { stringify } from 'csv-stringify';

export default class CsvWriter {
    constructor(path, options = {}, appendIfExists = false) {
        const append = appendIfExists && fs.existsSync(path);
        options.delimiter = options.delimiter || ',';
        options.header = !append;

        this.stream = stringify(options);
        this.writeStream = this.stream.pipe(fs.createWriteStream(path, append ? { flags: 'a' } : undefined));
    }

    newLine (object) {
        this.stream.write(object);
    }

    end () {
        return new Promise((resolve, reject) => {
            this.writeStream.on('finish', resolve);
            this.writeStream.on('error', reject);
            this.stream.end();
        });
    }
}