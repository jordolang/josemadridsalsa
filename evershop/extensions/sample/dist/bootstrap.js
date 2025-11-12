import path from 'path';
import { registerJob } from '@evershop/evershop/lib/cronjob';
export default function() {
    registerJob({
        name: 'sampleJob',
        schedule: '*/1 * * * *',
        resolve: path.resolve(import.meta.dirname, 'crons', 'everyMinute.js'),
        enabled: true
    });
}
