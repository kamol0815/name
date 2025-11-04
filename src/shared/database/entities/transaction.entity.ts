import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { PaymentProvider, PaymentType, TransactionStatus } from './enums';

@Entity('transactions')
@Index(['transId'], { unique: true })
export class TransactionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: PaymentProvider,
    })
    provider: PaymentProvider;

    @Column({
        type: 'enum',
        enum: PaymentType,
        nullable: true,
    })
    paymentType?: PaymentType;

    @Column({ type: 'varchar', nullable: true, unique: true })
    transId?: string;

    @Column({ type: 'varchar', nullable: true })
    selectedService?: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'bigint', nullable: true })
    prepareId?: number;

    @Column({ type: 'timestamp', nullable: true })
    performTime?: Date;

    @Column({ type: 'timestamp', nullable: true })
    cancelTime?: Date;

    @Column({ type: 'int', nullable: true })
    reason?: number;

    @Column({ type: 'int', nullable: true })
    state?: number;

    @Column({
        type: 'enum',
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    status: TransactionStatus;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid' })
    planId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
