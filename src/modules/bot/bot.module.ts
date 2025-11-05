import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotService } from './bot.service';
import {
  UserEntity,
  PlanEntity,
  TransactionEntity,
  UserCardEntity,
  UserSubscriptionEntity,
  UserPaymentEntity,
  UserFavoriteNameEntity,
  UserPersonaProfileEntity,
} from '../../shared/database/entities';
import { NameMeaningService } from './services/name-meaning.service';
import { NameInsightsService } from './services/name-insights.service';
import { UserFavoritesService } from './services/user-favorites.service';
import { UserPersonaService } from './services/user-persona.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      PlanEntity,
      TransactionEntity,
      UserCardEntity,
      UserSubscriptionEntity,
      UserPaymentEntity,
      UserFavoriteNameEntity,
      UserPersonaProfileEntity,
    ]),
  ],
  providers: [
    BotService,
    NameMeaningService,
    NameInsightsService,
    UserFavoritesService,
    UserPersonaService,
  ],
  exports: [BotService],
})
export class BotModule { }
