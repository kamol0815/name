import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClickSubsApiService } from './click-subs-api.service';
import { ClickSubsApiController } from './click-subs-api.controller';
import { UserEntity, PlanEntity, TransactionEntity, UserCardEntity, UserSubscriptionEntity } from '../../../shared/database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      PlanEntity,
      TransactionEntity,
      UserCardEntity,
      UserSubscriptionEntity,
    ]),
  ],
  controllers: [ClickSubsApiController],
  providers: [ClickSubsApiService],
  exports: [ClickSubsApiService],
})
export class ClickSubsApiModule { }
