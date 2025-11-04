import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { UserEntity, UserCardEntity, UserSubscriptionEntity } from 'src/shared/database/entities';
import { CardType, SubscriptionStatus } from 'src/shared/database/entities/enums';
import logger from 'src/shared/utils/logger';
import { PaymeSubsApiService } from '../payment-providers/payme-subs-api/payme-subs-api.service';
import { ClickSubsApiService } from '../payment-providers/click-subs-api/click-subs-api.service';
import { UzcardOnetimeApiService } from '../payment-providers/uzcard-onetime-api/uzcard-onetime-api.service';
import { buildSubscriptionManagementLink, buildSubscriptionCancellationLink } from 'src/shared/utils/payment-link.util';

@Injectable()
export class SubscriptionManagementService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserCardEntity)
    private readonly userCardRepository: Repository<UserCardEntity>,
    @InjectRepository(UserSubscriptionEntity)
    private readonly userSubscriptionRepository: Repository<UserSubscriptionEntity>,
    private readonly paymeSubsApiService: PaymeSubsApiService,
    private readonly clickSubsApiService: ClickSubsApiService,
    private readonly uzcardOnetimeApiService: UzcardOnetimeApiService,
  ) { }

  async cancelSubscription(dto: CancelSubscriptionDto) {
    const telegramId = this.parseTelegramId(dto.telegramId);

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      throw new NotFoundException(
        'Foydalanuvchi topilmadi. Telegram ID raqamini tekshiring.',
      );
    }

    const cards = await this.userCardRepository.find({
      where: {
        userId: user.id,
        isDeleted: Not(true),
      },
    });

    for (const card of cards) {
      const providerRemoved = await this.removeProviderCard(card);
      if (!providerRemoved) {
        logger.warn(
          `Provider removal failed for user ${user.id} cardType=${card.cardType}`,
        );
      }

      card.isDeleted = true;
      card.deletedAt = new Date();
      await this.userCardRepository.save(card);
    }

    await this.userSubscriptionRepository.update(
      { userId: user.id, isActive: true },
      {
        isActive: false,
        autoRenew: false,
        status: SubscriptionStatus.CANCELLED,
        endDate: new Date(),
      },
    );

    user.isActive = false;
    user.subscriptionEnd = new Date();
    await this.userRepository.save(user);

    logger.info(`Subscription cancelled for telegramId=${telegramId}`);

    return {
      success: true,
      message: 'Obuna muvaffaqiyatli bekor qilindi.',
    };
  }

  getCancellationLink(): string | undefined {
    return this.resolveCancellationLink();
  }

  buildCancellationUrlForUser(telegramId: number | string): string | undefined {
    return buildSubscriptionCancellationLink(telegramId);
  }

  private parseTelegramId(input: string): number {
    const digitsOnly = input?.replace(/\D/g, '');
    if (!digitsOnly) {
      throw new BadRequestException('Telegram ID raqamini to‘liq kiriting.');
    }

    const parsed = Number(digitsOnly);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Telegram ID noto‘g‘ri formatda.');
    }

    return parsed;
  }

  private async removeProviderCard(card: UserCardEntity): Promise<boolean> {
    switch (card.cardType) {
      case CardType.PAYME:
        return this.paymeSubsApiService.removeCard(card.cardToken);
      case CardType.CLICK:
        return this.clickSubsApiService.deleteCard(card.cardToken);
      case CardType.UZCARD:
        return this.uzcardOnetimeApiService.deleteCard(
          card.userId.toString(),
        );
      default:
        logger.error(`Unsupported card type for cancellation: ${card.cardType}`);
        return false;
    }
  }

  private resolveCancellationLink(): string | undefined {
    const link = buildSubscriptionManagementLink('subscription/cancel');
    return link;
  }
}
