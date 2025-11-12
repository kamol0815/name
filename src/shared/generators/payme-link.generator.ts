import { config } from '../config';
import logger from '../utils/logger';
import { buildMaskedPaymentLink } from '../utils/payment-link.util';
import { createSignedToken } from '../utils/signed-token.util';

export type PaymeLinkGeneratorParams = {
  planId: string;
  userId: string;
  amount: number;
};

const PAYME_CHECKOUT_URL = 'https://checkout.paycom.uz';

export function buildPaymeProviderUrl(
  params: PaymeLinkGeneratorParams,
): string {
  const merchantId = config.PAYME_MERCHANT_ID;
  const amountAsNumber = parseFloat(params.amount.toString());
  const amountInTiyns = Math.round(amountAsNumber * 100);
  const returnUrl = 'https://t.me/gbclilBot';

  logger.info('🔗 Payme link generation', {
    originalAmount: params.amount,
    amountAsNumber,
    amountInTiyns,
    planId: params.planId,
    userId: params.userId,
    merchantId, // Debug uchun qo'shamiz
  });

  if (!merchantId) {
    logger.error('❌ PAYME_MERCHANT_ID is not configured!');
    throw new Error('PAYME_MERCHANT_ID is not configured');
  }

  const paramsInString = `m=${merchantId};ac.plan_id=${params.planId};ac.user_id=${params.userId};ac.selected_service=${params.planId};a=${amountInTiyns};c=${encodeURIComponent(returnUrl)}`;
  logger.info('📋 Payme params string:', paramsInString);
  const encodedParams = base64Encode(paramsInString);
  const finalUrl = `${PAYME_CHECKOUT_URL}/${encodedParams}`;
  logger.info('🔗 Final Payme URL:', finalUrl);
  return finalUrl;
}

export function generatePaymeLink(params: PaymeLinkGeneratorParams): string {
  const token = createSignedToken(params, config.PAYMENT_LINK_SECRET);
  const redirectUrl = buildMaskedPaymentLink(`payme?token=${token}`);
  if (!redirectUrl) {
    return buildPaymeProviderUrl(params);
  }

  return redirectUrl;
}

function base64Encode(input: string): string {
  return Buffer.from(input).toString('base64');
}
