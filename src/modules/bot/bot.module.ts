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
} from '../../shared/database/entities';
import { NameMeaningService } from './services/name-meaning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      PlanEntity,
      TransactionEntity,
      UserCardEntity,
      UserSubscriptionEntity,
      UserPaymentEntity,
    ]),
  ],
  providers: [
    BotService,
    NameMeaningService,
  ],
  exports: [BotService],
})
export class BotModule { }
