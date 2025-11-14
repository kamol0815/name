import dotenv from 'dotenv';
import { cleanEnv, num, str } from 'envalid';

export type SubscriptionType = 'basic';

dotenv.config();

export const config = cleanEnv(process.env, {
  APP_PORT: num(),
  BASE_URL: str({ default: 'http://localhost:3000' }),
  BOT_TOKEN: str(),
  POSTGRES_URI: str(),
  CHANNEL_ID: str({ default: '' }),
  NODE_ENV: str({
    choices: ['development', 'production'],
    default: 'development',
  }),

  CLICK_SERVICE_ID: str(),
  CLICK_MERCHANT_ID: str(),
  CLICK_SECRET: str(),
  CLICK_MERCHANT_USER_ID: str(),

  PAYME_MERCHANT_ID: str(),
  PAYME_LOGIN: str(),
  PAYME_PASSWORD: str(),
  PAYME_PASSWORD_TEST: str(),
  PAYME_KEY: str({ default: '' }),
  PAYMENT_LINK_SECRET: str({ default: 'replace-me-with-secure-secret' }),
  PAYMENT_LINK_BASE_URL: str({ default: '' }),
  SUBSCRIPTION_BASE_URL: str({ default: '' }),
  SUBSCRIPTION_MANAGEMENT_BASE_URL: str({ default: '' }),
  SUBSCRIPTION_TERMS_URL: str({ default: 'https://surl.li/takrle' }),
  API_PREFIX: str({ default: 'api' }),
});
