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

// Wrap raw 16-bit signed little-endian PCM mono samples in a standard WAV header.
function wrapPcmToWav(pcmBuffer, sampleRate = 8000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // PCM chunk size
  header.writeUInt16LE(1, 20);           // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
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

  const raw = Buffer.from(response.audioContent, 'binary');

  if (format === 'wav') {
    return wrapPcmToWav(raw, 8000);
  }
  return raw;
}

async function synthesizeToFile(text, filename, options = {}) {
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  await fs.mkdir(audioDir, { recursive: true });
  const outputPath = path.join(audioDir, filename);

  const audio = await synthesizeToBuffer(text, options);
  await fs.writeFile(outputPath, audio, 'binary');
  return outputPath;
}

module.exports = { synthesizeToFile, synthesizeToBuffer, wrapPcmToWav };
