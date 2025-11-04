import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { CardType, SubscribedTo } from './enums';

@Entity('user_cards')
@Index(['userId'])
@Index(['planId'])
@Index(['verified'])
@Index(['verifiedDate'])
@Index(['expireDate'])
@Index(['userId', 'verified'])
@Index(['telegramId', 'cardType'], { unique: true })
export class UserCardEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint' })
    telegramId: number;

    @Column({ type: 'varchar', nullable: true })
    username?: string;

    @Column({ type: 'varchar', nullable: true, unique: true })
    incompleteCardNumber?: string;

    @Column({ type: 'varchar', unique: true })
    cardToken: string;

    @Column({ type: 'varchar', nullable: true })
    expireDate?: string;

    @Column({ type: 'int', nullable: true })
    verificationCode?: number;

    @Column({ type: 'boolean', default: false })
    verified: boolean;

    @Column({ type: 'timestamp', nullable: true })
    verifiedDate?: Date;

    @Column({ type: 'boolean', default: false })
    isDeleted: boolean;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt?: Date;

    @Column({
        type: 'enum',
        enum: CardType,
    })
    cardType: CardType;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid' })
    planId: string;

    // UzCard specific fields
    @Column({ type: 'boolean', nullable: true })
    UzcardIsTrusted?: boolean;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    UzcardBalance?: number;

    @Column({ type: 'bigint', nullable: true })
    UzcardId?: number;

    @Column({ type: 'varchar', nullable: true })
    UzcardOwner?: string;

    @Column({ type: 'varchar', nullable: true })
    UzcardIncompleteNumber?: string;

    @Column({ type: 'varchar', nullable: true })
    UzcardIdForDeleteCard?: string;

    @Column({
        type: 'simple-array',
        nullable: true,
        default: '[]',
    })
    subscribedTo?: SubscribedTo[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
