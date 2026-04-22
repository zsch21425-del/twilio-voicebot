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

async function synthesizeToBuffer(text, options = {}) {
  const languageCode = options.language || googleTtsLanguage;
  const voiceName = options.voice || googleTtsVoice;

  const [response] = await getClient().synthesizeSpeech({
    input: { text },
    voice: {
      languageCode,
      name: voiceName
    },
    audioConfig: {
      audioEncoding: 'MP3'
    }
  });

  return Buffer.from(response.audioContent, 'binary');
}

async function synthesizeToFile(text, filename, options = {}) {
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  await fs.mkdir(audioDir, { recursive: true });
  const outputPath = path.join(audioDir, filename);

  const audio = await synthesizeToBuffer(text, options);
  await fs.writeFile(outputPath, audio, 'binary');
  return outputPath;
}

module.exports = { synthesizeToFile, synthesizeToBuffer };
