——const fs = require('fs');
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/tmp/gcloud-key.json';
const json = process.env.GOOGLE_CREDENTIALS_JSON;
if (json) {
    fs.writeFileSync(keyPath, json);
    console.log('Wrote Google credentials to ' + keyPath);
} else {
    console.warn('GOOGLE_CREDENTIALS_JSON not set');
}
