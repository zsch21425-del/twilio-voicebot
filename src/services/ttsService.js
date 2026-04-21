const fs = require('fs/promises');
const path = require('path');
const textToSpeech = require('@google-cloud/text-to-speech');
const { googleTtsLanguage, googleTtsVoice, googleCredentialsPath } = require('../config');

let client;

function getClient() {
  if (!client) {
    client = new textToSpeech.TextToSpeechClient(
      googleCredentialsPath ? { keyFilename: googleCredentialsPath } : {}
    );
  }

  return client;
}

async function synthesizeToFile(text, filename) {
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  await fs.mkdir(audioDir, { recursive: true });
  const outputPath = path.join(audioDir, filename);

  const [response] = await getClient().synthesizeSpeech({
    input: { text },
    voice: {
      languageCode: googleTtsLanguage,
      name: googleTtsVoice
    },
    audioConfig: {
      audioEncoding: 'MP3'
    }
  });

  await fs.writeFile(outputPath, response.audioContent, 'binary');
  return outputPath;
}

module.exports = { synthesizeToFile };
