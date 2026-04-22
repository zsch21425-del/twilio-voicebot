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
  const format = options.format || 'mp3';          // 'mp3' for browser preview, 'wav' for Twilio PSTN

  const audioConfig = { audioEncoding: format === 'wav' ? 'LINEAR16' : 'MP3' };
  if (format === 'wav') {
    audioConfig.sampleRateHertz = 8000;
  }

  const [response] = await getClient().synthesizeSpeech({
    input: { text },
    voice: {
      languageCode,
      name: voiceName
    },
    audioConfig
  });

  // Google's LINEAR16 response already contains a complete WAV header (RIFF/WAVE),
  // so pass it through unchanged. MP3 responses are also returned as final bytes.
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
