var fs = require('fs');
var kp = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/tmp/gcloud-key.json';
var j = process.env.GOOGLE_CREDENTIALS_JSON;
if (j) { fs.writeFileSync(kp, j); console.log('wrote gcloud key'); }
else { console.warn('no GOOGLE_CREDENTIALS_JSON'); }
