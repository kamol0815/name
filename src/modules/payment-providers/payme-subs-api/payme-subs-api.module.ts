import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymeSubsApiService } from './payme-subs-api.service';
import { PaymeSubsApiController } from './payme-subs-api.controller';
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
  controllers: [PaymeSubsApiController],
  providers: [PaymeSubsApiService],
  exports: [PaymeSubsApiService],
})
export class PaymeSubsApiModule { }
