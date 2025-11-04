import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UzCardApiController } from './uzcard.controller';
import { UzCardApiService } from './uzcard.service';
import { BotModule } from '../../bot/bot.module';
import { UserEntity, PlanEntity, TransactionEntity, UserCardEntity, UserSubscriptionEntity } from '../../../shared/database/entities';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    BotModule,
    TypeOrmModule.forFeature([
      UserEntity,
      PlanEntity,
      TransactionEntity,
      UserCardEntity,
      UserSubscriptionEntity,
    ]),
  ],
  controllers: [UzCardApiController],
  providers: [UzCardApiService],
  exports: [UzCardApiService],
})
export class UzCardApiModule { }
