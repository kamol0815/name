import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UzcardOnetimeApiService } from './uzcard-onetime-api.service';
import { UzcardOnetimeApiController } from './uzcard-onetime-api.controller';
import { BotModule } from '../../bot/bot.module';
import { UserEntity, PlanEntity, TransactionEntity, UserCardEntity, UserSubscriptionEntity } from '../../../shared/database/entities';

@Module({
  imports: [
    BotModule,
    TypeOrmModule.forFeature([
      UserEntity,
      PlanEntity,
      TransactionEntity,
      UserCardEntity,
      UserSubscriptionEntity,
    ]),
  ],
  controllers: [UzcardOnetimeApiController],
  providers: [UzcardOnetimeApiService],
  exports: [UzcardOnetimeApiService],
})
export class UzcardOnetimeApiModule { }
