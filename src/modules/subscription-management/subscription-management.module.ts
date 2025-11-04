import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionManagementController } from './subscription-management.controller';
import { SubscriptionManagementService } from './subscription-management.service';
import { PaymeSubsApiModule } from '../payment-providers/payme-subs-api/payme-subs-api.module';
import { ClickSubsApiModule } from '../payment-providers/click-subs-api/click-subs-api.module';
import { UzcardOnetimeApiModule } from '../payment-providers/uzcard-onetime-api/uzcard-onetime-api.module';
import { UserEntity, UserCardEntity, UserSubscriptionEntity } from '../../shared/database/entities';

@Module({
  imports: [
    PaymeSubsApiModule,
    ClickSubsApiModule,
    UzcardOnetimeApiModule,
    TypeOrmModule.forFeature([UserEntity, UserCardEntity, UserSubscriptionEntity]),
  ],
  controllers: [SubscriptionManagementController],
  providers: [SubscriptionManagementService],
})
export class SubscriptionManagementModule { }
