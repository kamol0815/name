import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { SubscriptionType, SubscriptionStatus } from './enums';

@Entity('user_subscriptions')
@Index(['userId', 'isActive'])
@Index(['endDate'])
@Index(['status'])
export class UserSubscriptionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid' })
    planId: string;

    @Column({
        type: 'enum',
        enum: SubscriptionType,
    })
    subscriptionType: SubscriptionType;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    startDate: Date;

    @Column({ type: 'timestamp' })
    endDate: Date;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'boolean', default: false })
    autoRenew: boolean;

    @Column({
        type: 'enum',
        enum: SubscriptionStatus,
        default: SubscriptionStatus.ACTIVE,
    })
    status: SubscriptionStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    paidAmount: number;

    @Column({ type: 'boolean', default: false })
    isTrial: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
