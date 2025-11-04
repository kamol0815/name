import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClickController } from './click.controller';
import { ClickService } from './click.service';
import { BotModule } from '../../bot/bot.module';
import { UserEntity, PlanEntity, TransactionEntity } from '../../../shared/database/entities';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity, PlanEntity, TransactionEntity]),
    forwardRef(() => BotModule),
  ],
  controllers: [ClickController],
  providers: [ClickService],
})
export class ClickModule { }
