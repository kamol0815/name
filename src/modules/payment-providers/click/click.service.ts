import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { ClickRequest } from './types/click-request.type';
import { ClickAction, ClickError } from './enums';
import logger from '../../../shared/utils/logger';
import { generateMD5 } from '../../../shared/utils/hashing/hasher.helper';
import { UserEntity, PlanEntity, TransactionEntity } from '../../../shared/database/entities';
import { TransactionStatus, PaymentProvider } from '../../../shared/database/entities/enums';
import { BotService } from '../../bot/bot.service';

type TransactionContext = {
  planId?: string;
  userId?: string;
};

function parseMerchantTransactionId(value?: string): TransactionContext {
  if (!value) {
    return {};
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch (error) {
    logger.warn('Failed to decodeURIComponent for merchant_trans_id', {
      merchant_trans_id: value,
      error,
    });
  }

  const [planId, userId] = decoded.split('.');

  return {
    planId: planId || undefined,
    userId: userId || undefined,
  };
}

function hasActiveSubscription(user?: {
  isActive?: boolean;
  subscriptionEnd?: Date | null;
}): boolean {
  if (!user || !user.isActive || !user.subscriptionEnd) {
    return false;
  }

  const subscriptionEnd =
    user.subscriptionEnd instanceof Date
      ? user.subscriptionEnd
      : new Date(user.subscriptionEnd);

  return subscriptionEnd.getTime() > Date.now();
}

@Injectable()
export class ClickService {
  private readonly secretKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly botService: BotService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {
    const secretKey = this.configService.get<string>('CLICK_SECRET');
    if (!secretKey) {
      throw new Error('CLICK_SECRET is not defined in the configuration');
    }
    this.secretKey = secretKey;
  }

  async handleMerchantTransactions(clickReqBody: ClickRequest) {
    const actionType = +clickReqBody.action;
    clickReqBody.amount = parseFloat(clickReqBody.amount + '');

    logger.info(
      `Handling merchant transaction with action type: ${actionType}`,
    );

    switch (actionType) {
      case ClickAction.Prepare:
        return this.prepare(clickReqBody);
      case ClickAction.Complete:
        return this.complete(clickReqBody);
      default:
        return {
          error: ClickError.ActionNotFound,
          error_note: 'Invalid action',
        };
    }
  }

  async prepare(clickReqBody: ClickRequest) {
    logger.info('Preparing transaction', { clickReqBody });

    const merchantTransId = clickReqBody.merchant_trans_id;
    const context = parseMerchantTransactionId(merchantTransId);
    const planId = context.planId ?? merchantTransId;
    const merId = merchantTransId;
    const userId = clickReqBody.param2 ?? context.userId;
    const amount = clickReqBody.amount;

    if (!userId) {
      logger.error('Click prepare received without userId', {
        merchant_trans_id: merchantTransId,
        context,
      });
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid userId',
      };
    }

    const transId = clickReqBody.click_trans_id + '';
    const signString = clickReqBody.sign_string;
    const signTime = new Date(clickReqBody.sign_time).toISOString();

    const myMD5Params = {
      clickTransId: transId,
      serviceId: clickReqBody.service_id,
      secretKey: this.secretKey,
      merchantTransId: merId,
      amount: amount,
      action: clickReqBody.action,
      signTime: clickReqBody.sign_time,
    };

    const myMD5Hash = generateMD5(myMD5Params);

    if (signString !== myMD5Hash) {
      logger.warn('Signature validation failed', { transId });
      return {
        error: ClickError.SignFailed,
        error_note: 'Invalid sign_string',
      };
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid userId',
      };
    }

    if (hasActiveSubscription(user)) {
      return {
        error: ClickError.AlreadyPaid,
        error_note: 'User already has an active subscription',
      };
    }

    // Plan mavjudligini va amount to'g'riligini tekshirish
    const plan = await this.planRepository.findOne({ where: { id: planId } });

    if (!plan) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid planId',
      };
    }

    // Click da summa integer bo'lishi kerak (5555), Payme da decimal (5555.00)
    if (parseInt(`${amount}`) !== parseInt(`${plan.price}`)) {
      logger.warn('Amount mismatch in Click prepare', {
        clickAmount: parseInt(`${amount}`),
        planPrice: parseInt(`${plan.price}`),
        planPriceOriginal: plan.price
      });
      return {
        error: ClickError.InvalidAmount,
        error_note: 'Invalid amount',
      };
    }

    // Check if the transaction already exists and is not in a PENDING state
    const existingTransaction = await this.transactionRepository.findOne({
      where: {
        transId: transId,
        status: Not(TransactionStatus.PENDING),
      },
    });

    if (existingTransaction) {
      return {
        error: ClickError.AlreadyPaid,
        error_note: 'Transaction already processed',
      };
    }

    // Create a new transaction only if it doesn't exist or is in a PENDING state
    const time = new Date().getTime();
    const newTransaction = this.transactionRepository.create({
      provider: PaymentProvider.CLICK,
      planId,
      userId,
      transId,
      prepareId: time,
      status: TransactionStatus.PENDING,
      amount: parseInt(`${clickReqBody.amount}`), // Click da integer sifatida saqlash
      createdAt: new Date(time),
    });
    await this.transactionRepository.save(newTransaction);

    return {
      click_trans_id: +transId,
      merchant_trans_id: planId,
      merchant_prepare_id: time,
      error: ClickError.Success,
      error_note: 'Success',
    };
  }

  async complete(clickReqBody: ClickRequest) {
    logger.info('Completing transaction', { clickReqBody });

    const merchantTransId = clickReqBody.merchant_trans_id;
    const context = parseMerchantTransactionId(merchantTransId);
    const planId = context.planId ?? merchantTransId;
    const merId = merchantTransId;
    const userId = clickReqBody.param2 ?? context.userId;
    const prepareId = clickReqBody.merchant_prepare_id;
    const transId = clickReqBody.click_trans_id + '';
    const serviceId = clickReqBody.service_id;
    const amount = clickReqBody.amount;

    if (!userId) {
      logger.error('Click complete received without userId', {
        merchant_trans_id: merchantTransId,
        context,
      });
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid userId',
      };
    }

    const signTime = clickReqBody.sign_time;
    const error = clickReqBody.error;
    const signString = clickReqBody.sign_string;

    const myMD5Params = {
      clickTransId: transId,
      serviceId,
      secretKey: this.secretKey,
      merchantTransId: merId,
      merchantPrepareId: prepareId,
      amount,
      action: clickReqBody.action,
      signTime,
    };

    const myMD5Hash = generateMD5(myMD5Params);

    if (signString !== myMD5Hash) {
      return {
        error: ClickError.SignFailed,
        error_note: 'Invalid sign_string',
      };
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid userId',
      };
    }

    if (hasActiveSubscription(user)) {
      await this.transactionRepository.update(
        { transId },
        {
          status: TransactionStatus.CANCELED,
          cancelTime: new Date(),
        },
      );

      return {
        error: ClickError.AlreadyPaid,
        error_note: 'User already has an active subscription',
      };
    }

    const plan = await this.planRepository.findOne({ where: { id: planId } });

    if (!plan) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid planId',
      };
    }

    const isPrepared = await this.transactionRepository.findOne({
      where: {
        prepareId,
        userId,
        planId,
      },
    });

    if (!isPrepared) {
      return {
        error: ClickError.TransactionNotFound,
        error_note: 'Invalid merchant_prepare_id',
      };
    }

    const isAlreadyPaid = await this.transactionRepository.findOne({
      where: {
        planId,
        prepareId,
        status: TransactionStatus.PAID,
      },
    });

    if (isAlreadyPaid) {
      return {
        error: ClickError.AlreadyPaid,
        error_note: 'Already paid',
      };
    }

    // Click da summa integer bo'lishi kerak (5555), Payme da decimal (5555.00)
    if (parseInt(`${amount}`) !== parseInt(`${plan.price}`)) {
      logger.warn('Amount mismatch in Click complete', {
        clickAmount: parseInt(`${amount}`),
        planPrice: parseInt(`${plan.price}`),
        planPriceOriginal: plan.price
      });
      return {
        error: ClickError.InvalidAmount,
        error_note: 'Invalid amount',
      };
    }

    const transaction = await this.transactionRepository.findOne({
      where: { transId },
    });

    if (transaction && transaction.status === TransactionStatus.CANCELED) {
      return {
        error: ClickError.TransactionCanceled,
        error_note: 'Already cancelled',
      };
    }

    if (error > 0) {
      await this.transactionRepository.update(
        { transId: transId },
        { status: TransactionStatus.FAILED },
      );
      return {
        error: error,
        error_note: 'Failed',
      };
    }

    await this.transactionRepository.update(
      { transId: transId },
      { status: TransactionStatus.PAID },
    );

    // Foydalanuvchini VIP qilish (umrbod obuna)
    if (transaction && transaction.userId && plan) {
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 100); // 100 yil (umrbod)

      await this.userRepository.update(
        { id: transaction.userId },
        {
          isActive: true,
          subscriptionEnd: subscriptionEndDate
        }
      );

      logger.info('✅ User activated with lifetime subscription', {
        userId: transaction.userId,
        transId: transaction.transId,
        amount: transaction.amount,
        subscriptionEnd: subscriptionEndDate,
      });

      // Bot orqali foydalanuvchiga xabar berish
      try {
        const bot = this.botService.getBot();
        await bot.api.sendMessage(
          user.telegramId,
          `🎉 <b>Tabriklaymiz!</b>\n\n` +
          `✅ To'lov muvaffaqiyatli amalga oshirildi!\n` +
          `💰 Summa: ${plan.price} so'm\n\n` +
          `🌟 <b>Endi siz VIP foydalanuvchisiz!</b>\n` +
          `♾️ Barcha ismlar manosi umrbod ochiq!\n\n` +
          `Botdan bemalol foydalanishingiz mumkin! 🚀\n\n` +
          `🔮 Endi asosiy botga o'ting: @gbclilBot`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🔮 Asosiy botga o\'tish',
                    url: 'https://t.me/gbclilBot'
                  }
                ]
              ]
            }
          }
        );
      } catch (notificationError) {
        logger.error('Failed to send payment success notification:', notificationError);
      }
    }

    return {
      click_trans_id: +transId,
      merchant_trans_id: planId,
      error: ClickError.Success,
      error_note: 'Success',
    };
  }
}
