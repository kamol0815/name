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
  providers: [BotService],
  exports: [BotService],
})
export class BotModule { }
