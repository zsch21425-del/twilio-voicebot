const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : '',
  googleTtsLanguage: process.env.GOOGLE_TTS_LANGUAGE || 'en-US',
  googleTtsVoice: process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-C',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  alpacaKeyId: process.env.ALPACA_KEY_ID || '',
  alpacaSecretKey: process.env.ALPACA_SECRET_KEY || '',
  alpacaBaseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
  alpacaAutoExecuteMaxUsd: Number(process.env.ALPACA_AUTO_EXECUTE_MAX_USD || 500),
  alpacaAutoExecuteEnabled: process.env.ALPACA_AUTO_EXECUTE_ENABLED === 'true',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || ''
};
