import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToMany,
    OneToOne,
} from 'typeorm';
import { SubscriptionType } from './enums';

@Entity('users')
@Index(['telegramId', 'isActive'])
@Index(['subscriptionEnd'])
export class UserEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint', unique: true })
    @Index()
    telegramId: number;

    @Column({ type: 'varchar', nullable: true })
    username?: string;

    @Column({ type: 'varchar', nullable: true })
    firstName?: string;

    @Column({ type: 'varchar', nullable: true })
    lastName?: string;

    @Column({
        type: 'enum',
        enum: SubscriptionType,
        nullable: true,
    })
    subscriptionType?: SubscriptionType;

    @Column({ type: 'timestamp', nullable: true })
    subscriptionStart?: Date;

    @Column({ type: 'timestamp', nullable: true })
    subscriptionEnd?: Date;

    @Column({ type: 'boolean', default: false })
    isActive: boolean;

    @Column({ type: 'boolean', default: false })
    hasReceivedFreeBonus: boolean;

    @Column({ type: 'boolean', default: false })
    hadPaidSubscriptionBeforeBonus: boolean;

    @Column({ type: 'timestamp', nullable: true })
    freeBonusReceivedAt?: Date;

    @Column({ type: 'boolean', default: false })
    isKickedOut: boolean;

    @Column({ type: 'varchar', nullable: true })
    activeInviteLink?: string;



    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
