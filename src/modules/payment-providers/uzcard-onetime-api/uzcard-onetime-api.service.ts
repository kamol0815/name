import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FiscalDto,
  UzcardPaymentConfirm,
  UzcardPaymentDto,
  UzcardPaymentResponseDto,
} from './dtos/uzcard-payment.dto';
import axios from 'axios';
import { BotService } from '../../bot/bot.service';
import {
  UserEntity,
  PlanEntity,
  TransactionEntity,
  UserCardEntity,
  UserSubscriptionEntity,
} from '../../../shared/database/entities';
import {
  PaymentProvider,
  TransactionStatus,
  CardType,
  PaymentType,
  SubscriptionType,
  SubscriptionStatus,
} from '../../../shared/database/entities/enums';
import logger from '../../../shared/utils/logger';
import { getFiscal } from '../../../shared/utils/get-fiscal';
import { uzcardAuthHash } from '../../../shared/utils/hashing/uzcard-auth-hash';

export interface ErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

@Injectable()
export class UzcardOnetimeApiService {
  private baseUrl = process.env.UZCARD_BASE_URL;

  constructor(
    private readonly botService: BotService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(UserCardEntity)
    private readonly userCardRepository: Repository<UserCardEntity>,
    @InjectRepository(UserSubscriptionEntity)
    private readonly userSubscriptionRepository: Repository<UserSubscriptionEntity>,
  ) { }

  async paymentWithoutRegistration(
    dto: UzcardPaymentDto,
  ): Promise<UzcardPaymentResponseDto | ErrorResponse> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: dto.userId },
      });

      if (!user) {
        throw new Error('User not found or unauthorized');
      }

      const plan = await this.planRepository.findOne({
        where: { id: dto.planId },
      });

      if (!plan) {
        return {
          success: false,
          errorCode: 'plan_not_found',
          message: 'Plan not found',
        };
      }

      const extraId = this.generateExtraId(dto.userId);

      logger.info(`Generated extraId: ${extraId}`);

      const payload = {
        cardNumber: dto.cardNumber,
        expireDate: dto.expireDate,
        amount: plan.price,
        extraId: extraId,
      };

      const headers = this.getHeaders();

      const apiResponse = await axios.post(
        `${this.baseUrl}/Payment/paymentWithoutRegistration`,
        payload,
        { headers },
      );

      if (apiResponse.data.error) {
        const errorCode =
          apiResponse.data.error.errorCode?.toString() || 'unknown';
        return {
          success: false,
          errorCode: errorCode,
          message:
            apiResponse.data.error.errorMessage ||
            this.getErrorMessage(errorCode),
        };
      }

      const response: UzcardPaymentResponseDto = {
        session: apiResponse.data.result.session,
        otpSentPhone: apiResponse.data.result.otpSentPhone,
        success: true,
      };

      return response;
    } catch (error) {
      // @ts-ignore

      // @ts-ignore
      if (error.response && error.response.data && error.response.data.error) {
        // @ts-ignore
        const errorCode =
          error.response.data.error.errorCode?.toString() || 'unknown';
        return {
          success: false,
          errorCode: errorCode,
          // @ts-ignore
          message:
            error.response.data.error.errorMessage ||
            this.getErrorMessage(errorCode),
        };
      }

      // Handle network or other errors
      return {
        success: false,
        errorCode: 'api_error',
        message: "Serverda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.",
      };
    }
  }

  async confirmPaymentWithoutRegistration(
    dto: UzcardPaymentConfirm,
  ): Promise<{ success: boolean } | ErrorResponse> {
    try {
      logger.info(`Request body: ${JSON.stringify(dto)}`);
      const user = await this.userRepository.findOne({
        where: { id: dto.userId },
      });
      if (!user) {
        throw new Error('User not found or unauthorized');
      }
      const plan = await this.planRepository.findOne({
        where: { selectedName: dto.selectedService },
      });

      if (!plan) {
        return {
          success: false,
          errorCode: 'plan_not_found',
          message: 'Plan not found',
        };
      }

      const payload = {
        session: dto.session,
        otp: dto.otp,
      };

      const headers = this.getHeaders();

      const apiResponse = await axios.post(
        `${this.baseUrl}/Payment/confirmPayment`,
        payload,
        { headers },
      );

      // Check for error response in the standard UzCard format
      if (apiResponse.data.error) {
        const errorCode =
          apiResponse.data.error.errorCode?.toString() || 'unknown';
        return {
          success: false,
          errorCode: errorCode,
          message:
            apiResponse.data.error.errorMessage ||
            this.getErrorMessage(errorCode),
        };
      }

      const cardDetails = apiResponse.data.result;

      const fiscalPayload: FiscalDto = {
        transactionId: cardDetails.transactionId,
        receiptId: cardDetails.utrno,
      };

      const transaction = this.transactionRepository.create({
        provider: PaymentProvider.UZCARD,
        paymentType: PaymentType.ONETIME,
        transId: cardDetails.transactionId.toString(),
        amount: cardDetails.amount,
        status: TransactionStatus.PAID,
        userId: dto.userId,
        planId: plan?.id || '',
      });

      await this.transactionRepository.save(transaction);

      logger.info(
        `New user transaction created: ${JSON.stringify(transaction)}`,
      );

      // logger.info(`getFiscal arguments: ${JSON.stringify(fiscalPayload)}`);
      // const fiscalResult = await getFiscal(fiscalPayload);
      //
      // if (!fiscalResult.success) {
      //   logger.error(
      //     `There is error with fiscalization in confirmPaymentWithoutRegistration method`,
      //   );
      // }

      logger.info(`Card details: ${JSON.stringify(cardDetails)}`);

      // Foydalanuvchini VIP qilish (umrbod obuna)
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 100); // 100 yil (umrbod)

      await this.userRepository.update(
        { id: user.id },
        {
          subscriptionType: 'onetime' as any,
          isActive: true,
          subscriptionEnd: subscriptionEndDate
        },
      );

      const newSubscription = this.userSubscriptionRepository.create({
        userId: transaction.userId,
        planId: transaction.planId,
        subscriptionType: SubscriptionType.ONETIME,
        startDate: new Date(),
        endDate: subscriptionEndDate, // umrbod obuna
        isActive: true,
        autoRenew: false,
        status: SubscriptionStatus.ACTIVE,
        paidAmount: cardDetails.amount,
        isTrial: false,
      });

      await this.userSubscriptionRepository.save(newSubscription);

      logger.info('✅ User activated with lifetime subscription via UzCard', {
        userId: user.id,
        telegramId: user.telegramId,
        transId: transaction.transId,
        amount: cardDetails.amount,
        subscriptionEnd: subscriptionEndDate,
      });

      if (user && plan) {
        // Bot orqali foydalanuvchiga xabar berish
        try {
          const bot = this.botService.getBot();
          await bot.api.sendMessage(
            user.telegramId,
            `🎉 <b>Tabriklaymiz!</b>\n\n` +
            `✅ UzCard orqali to'lov muvaffaqiyatli amalga oshirildi!\n` +
            `💰 Summa: ${cardDetails.amount} so'm\n` +
            `📦 Reja: ${plan.name}\n\n` +
            `🌟 <b>Endi siz VIP foydalanuvchisiz!</b>\n` +
            `♾️ Barcha ismlar manosi umrbod ochiq!\n\n` +
            `Botdan bemalol foydalanishingiz mumkin! 🚀`,
            {
              parse_mode: 'HTML'
            }
          );
        } catch (notificationError) {
          logger.error('Failed to send UzCard payment success notification:', notificationError);
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      // @ts-ignore
      if (error.response && error.response.data && error.response.data.error) {
        // @ts-ignore
        const errorCode =
          error.response.data.error.errorCode?.toString() || 'unknown';
        return {
          success: false,
          errorCode: errorCode,
          // @ts-ignore
          message:
            error.response.data.error.errorMessage ||
            this.getErrorMessage(errorCode),
        };
      }

      // @ts-ignore
      if (error.message && error.message.includes('OTP')) {
        return {
          success: false,
          errorCode: '-137',
          message: this.getErrorMessage('-137'),
        };
      }

      // Handle network or other errors
      return {
        success: false,
        errorCode: 'api_error',
        message: "Serverda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.",
      };
    }
  }

  async resendCode(
    session: string,
    userId: string,
  ): Promise<
    | {
      success: boolean;
      session: string;
      message: string;
    }
    | ErrorResponse
  > {
    try {
      const headers = this.getHeaders();

      const response = await axios.get(
        `${this.baseUrl}/Payment/resendOtp?session=${encodeURIComponent(session)}`,
        { headers },
      );

      if (response.data.error) {
        const errorCode =
          response.data.error.errorCode?.toString() || 'unknown';
        return {
          success: false,
          errorCode: errorCode,
          message:
            response.data.error.errorMessage || this.getErrorMessage(errorCode),
        };
      }

      return {
        success: true,
        session: session,
        message: 'Otp resent successfully',
      };
    } catch (error) {
      // @ts-ignore

      // @ts-ignore
      if (error.response && error.response.data && error.response.data.error) {
        // @ts-ignore
        const errorCode =
          error.response.data.error.errorCode?.toString() || 'unknown';
        return {
          success: false,
          errorCode: errorCode,
          // @ts-ignore
          message:
            error.response.data.error.errorMessage ||
            this.getErrorMessage(errorCode),
        };
      }

      // @ts-ignore
      if (error.message && error.message.includes('OTP')) {
        return {
          success: false,
          errorCode: '-137',
          message: this.getErrorMessage('-137'),
        };
      }

      return {
        success: false,
        errorCode: 'api_error',
        message: "Serverda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.",
      };
    }
  }

  async deleteCard(id: string): Promise<boolean> {
    const headers = this.getHeaders();

    const userCard = await this.userCardRepository.findOne({
      where: {
        userId: id,
        cardType: CardType.UZCARD,
      },
    });

    if (!userCard || !userCard.UzcardIdForDeleteCard) {
      logger.error(
        `Failed to delete card: Card not found or missing UzcardIdForDeleteCard for user ${id}`,
      );
      return false;
    }

    const uzcardIdForDelete = userCard?.UzcardIdForDeleteCard;

    try {
      const response = await axios.delete(
        `${this.baseUrl}/UserCard/deleteUserCard`,
        {
          headers,
          params: { userCardId: uzcardIdForDelete },
        },
      );

      // Optional logging
      console.log('Delete response:', response.data);

      return response.data?.result?.success === true;
    } catch (error) {
      console.error('Failed to delete card:', error);
      return false; // or throw if you want to handle it higher up
    }
  }

  private getHeaders() {
    const authHeader = uzcardAuthHash();

    return {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Authorization: authHeader,
      Language: 'uz',
    };
  }

  private generateExtraId(userId: string): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `${userId}-${timestamp}-${random}`;
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages = {
      // card errors
      '-101': `Karta malumotlari noto'g'ri. Iltimos tekshirib qaytadan kiriting.`,
      '-103': `Amal qilish muddati noto'g'ri. Iltimos tekshirib qaytadan kiriting.`,
      '-104': 'Karta aktive emas. Bankga murojaat qiling.',
      '-108': `Bu karta allaqachon obunaga ulangan. Iltimos, boshqa karta bilan to'lovni amalga oshiring yoki Click/Payme orqali to'lang.`,

      // sms errors
      '-113': `Tasdiqlash kodi muddati o'tgan. Qayta yuborish tugmasidan foydalaning.`,
      '-137': `Tasdiqlash kodi noto'g'ri.`,

      // additional common errors
      '-110': "Kartada yetarli mablag' mavjud emas.",
      '-120': 'Kartangiz bloklangan. Bankga murojaat qiling.',
      '-130':
        "Xavfsizlik chegaralaridan oshib ketdi. Keyinroq qayta urinib ko'ring.",
    };

    //@ts-ignore
    return (
      errorMessages[errorCode] ||
      "Kutilmagan xatolik yuz berdi. Iltimos qaytadan urinib ko'ring."
    );
  }
}
