import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClickOnetimeController } from './click-onetime.controller';
import { ClickOnetimeService } from './click-onetime.service';
import {
    UserEntity,
    PlanEntity,
    TransactionEntity,
    UserSubscriptionEntity,
} from '../../../shared/database/entities';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
            UserEntity,
            PlanEntity,
            TransactionEntity,
            UserSubscriptionEntity,
        ]),
    ],
    controllers: [ClickOnetimeController],
    providers: [ClickOnetimeService],
    exports: [ClickOnetimeService]
})
export class ClickOnetimeModule { }
