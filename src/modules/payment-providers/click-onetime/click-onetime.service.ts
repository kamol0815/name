import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
    UserEntity,
    PlanEntity,
    TransactionEntity,
    UserSubscriptionEntity,
    TransactionStatus,
    PaymentProvider,
    SubscriptionType,
    SubscriptionStatus,
    PaymentType,
} from 'src/shared/database/entities';
import { BotService } from '../../bot/bot.service';

/**
 * Professional Click One-time Payment Service
 * Handles Click payment gateway integration for one-time payments
 * 
 * @author Senior Payment Integration Team
 * @version 2.0.0
 */
@Injectable()
export class ClickOnetimeService {
    private readonly logger = new Logger(ClickOnetimeService.name);
    private readonly clickServiceId: string;
    private readonly clickMerchantId: string;
    private readonly clickSecretKey: string;
    private readonly clickMerchantUserId: string;
    private readonly returnUrl: string;

    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        @InjectRepository(PlanEntity)
        private readonly planRepository: Repository<PlanEntity>,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        @InjectRepository(UserSubscriptionEntity)
        private readonly subscriptionRepository: Repository<UserSubscriptionEntity>,
        private readonly configService: ConfigService,
        private readonly dataSource: DataSource,
        private readonly botService: BotService,
    ) {
        // Validate required environment variables
        this.clickServiceId = this.configService.get<string>('CLICK_SERVICE_ID');
        this.clickMerchantId = this.configService.get<string>('CLICK_MERCHANT_ID');
        this.clickSecretKey = this.configService.get<string>('CLICK_SECRET');
        this.clickMerchantUserId = this.configService.get<string>('CLICK_MERCHANT_USER_ID');
        this.returnUrl = this.configService.get<string>('BOT_URL', 'https://t.me/ismlar_manosi_uzbot');

        if (!this.clickServiceId || !this.clickMerchantId || !this.clickSecretKey) {
            this.logger.error('❌ Click credentials not properly configured');
            throw new Error('Click payment provider not properly configured');
        }

        this.logger.log('✅ Click One-time Payment Service initialized');
    }

    /**
     * Generate Click payment link
     * @param userId - User ID
     * @param planId - Plan ID
     * @param amount - Payment amount in UZS
     * @returns Payment link URL
     */
    generatePaymentLink(userId: string, planId: string, amount: string): string {
        if (!userId || !planId || !amount) {
            throw new BadRequestException('Missing required parameters');
        }

        const merchantTransId = `${userId}.${planId}`;
        const paymentLink = `https://my.click.uz/services/pay?service_id=${this.clickServiceId}&merchant_id=${this.clickMerchantId}&amount=${amount}&transaction_param=${userId}&additional_param3=${planId}&return_url=${encodeURIComponent(this.returnUrl)}`;

        this.logger.log(`💳 Payment link generated for user ${userId}, amount: ${amount} UZS`);
        return paymentLink;
    }

    /**
     * Handle Click callback (webhook)
     * Processes PREPARE (action=0) and COMPLETE (action=1) requests
     * 
     * @param clickReqBody - Click callback data
     * @returns Response according to Click API specification
     */
    async handleClickCallback(clickReqBody: any) {
        const { click_trans_id, merchant_trans_id, action } = clickReqBody;

        this.logger.log(`📨 Click callback received: action=${action}, trans_id=${click_trans_id}`);

        // Step 1: Verify signature
        const isValidSign = this.verifySignature(clickReqBody);
        if (!isValidSign) {
            this.logger.error(`❌ Invalid signature for transaction ${click_trans_id}`);
            return this.createErrorResponse(click_trans_id, merchant_trans_id, -1, 'Invalid signature');
        }

        // Step 2: Route to appropriate handler
        try {
            if (action == 0) {
                return await this.prepareTransaction(clickReqBody);
            } else if (action == 1) {
                return await this.completeTransaction(clickReqBody);
            }

            return this.createErrorResponse(click_trans_id, merchant_trans_id, -3, 'Unknown action');
        } catch (error) {
            this.logger.error(`❌ Error handling Click callback: ${error.message}`, error.stack);
            return this.createErrorResponse(click_trans_id, merchant_trans_id, -1, 'Internal error');
        }
    }

    /**
     * Create standardized error response
     */
    private createErrorResponse(click_trans_id: string, merchant_trans_id: string, error: number, error_note: string) {
        return {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error,
            error_note
        };
    }

    /**
     * To'lovni tayyorlash (action=0)
     */
    private async prepareTransaction(clickReqBody: any) {
        const {
            click_trans_id,
            merchant_trans_id,
            amount,
            param2, // planId
        } = clickReqBody;

        try {
            this.logger.log(`Preparing transaction ${JSON.stringify({ clickReqBody })}`);

            const userId = merchant_trans_id.split('.')[0] || merchant_trans_id;
            const planId = merchant_trans_id.split('.')[1] || param2;

            if (!planId) {
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_prepare_id: null,
                    error: -5,
                    error_note: 'Plan ID not found'
                };
            }

            // User va Plan mavjudligini tekshirish
            const user = await this.userRepository.findOne({
                where: { id: userId }
            });
            if (!user) {
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_prepare_id: null,
                    error: -5,
                    error_note: 'User not found'
                };
            }

            const plan = await this.planRepository.findOne({
                where: { id: planId }
            });
            if (!plan) {
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_prepare_id: null,
                    error: -5,
                    error_note: 'Plan not found'
                };
            }

            // Summani tekshirish - Click da integer bo'lishi kerak
            if (parseInt(`${amount}`) !== parseInt(`${plan.price}`)) {
                this.logger.warn('Amount mismatch in Click onetime', {
                    clickAmount: parseInt(`${amount}`),
                    planPrice: parseInt(`${plan.price}`),
                    planPriceOriginal: plan.price
                });
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_prepare_id: null,
                    error: -2,
                    error_note: 'Incorrect amount'
                };
            }

            // Transaction yaratish
            const transaction = this.transactionRepository.create({
                userId,
                planId,
                amount: Number(amount),
                transId: click_trans_id.toString(),
                state: 0, // PREPARED
                provider: PaymentProvider.CLICK,
                status: TransactionStatus.PENDING,
            });

            const savedTransaction = await this.transactionRepository.save(transaction);

            return {
                click_trans_id,
                merchant_trans_id,
                merchant_prepare_id: savedTransaction.id,
                error: 0,
                error_note: 'Success'
            };
        } catch (error) {
            this.logger.error(`Error in prepareTransaction: ${error.message}`, error.stack);
            return {
                click_trans_id,
                merchant_trans_id,
                merchant_prepare_id: null,
                error: -1,
                error_note: 'Internal error'
            };
        }
    }

    /**
     * Complete transaction (action=1)
     * Uses database transaction to ensure atomicity
     * 
     * @param clickReqBody - Click callback data
     */
    private async completeTransaction(clickReqBody: any) {
        const { click_trans_id, merchant_trans_id, merchant_prepare_id, error } = clickReqBody;

        // Handle payment failure
        if (error !== 0) {
            this.logger.warn(`⚠️ Payment failed for transaction ${click_trans_id}, error: ${error}`);
            await this.transactionRepository.update(
                { id: merchant_prepare_id },
                {
                    state: -1,
                    status: TransactionStatus.FAILED,
                    reason: error,
                    cancelTime: new Date()
                }
            );

            return {
                click_trans_id,
                merchant_trans_id,
                merchant_confirm_id: merchant_prepare_id,
                error: 0,
                error_note: 'Success'
            };
        }

        // Use QueryRunner for transaction management
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Step 1: Find and validate transaction
            const transaction = await queryRunner.manager.findOne(TransactionEntity, {
                where: { id: merchant_prepare_id }
            });

            if (!transaction) {
                await queryRunner.rollbackTransaction();
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_confirm_id: null,
                    error: -6,
                    error_note: 'Transaction not found'
                };
            }

            // Step 2: Find user
            const user = await queryRunner.manager.findOne(UserEntity, {
                where: { id: transaction.userId }
            });

            if (!user) {
                await queryRunner.rollbackTransaction();
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_confirm_id: merchant_prepare_id,
                    error: -5,
                    error_note: 'User not found'
                };
            }

            // Step 3: Find plan
            const plan = await queryRunner.manager.findOne(PlanEntity, {
                where: { id: transaction.planId }
            });

            if (!plan) {
                await queryRunner.rollbackTransaction();
                return {
                    click_trans_id,
                    merchant_trans_id,
                    merchant_confirm_id: merchant_prepare_id,
                    error: -5,
                    error_note: 'Plan not found'
                };
            }

            // Step 4: Update transaction to PAID
            transaction.state = 1;
            transaction.status = TransactionStatus.PAID;
            transaction.performTime = new Date();
            await queryRunner.manager.save(transaction);

            // Step 5: Activate user subscription (lifetime access for one-time payment)
            const startDate = new Date();
            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 100); // 100 years = lifetime

            user.isActive = true;
            user.subscriptionStart = startDate;
            user.subscriptionEnd = endDate;
            user.subscriptionType = SubscriptionType.ONETIME;
            await queryRunner.manager.save(user);

            // Step 6: Deactivate any existing active subscriptions
            await queryRunner.manager.update(
                UserSubscriptionEntity,
                { userId: user.id, isActive: true },
                { isActive: false, status: SubscriptionStatus.CANCELLED }
            );

            // Step 7: Create new subscription record
            const subscription = queryRunner.manager.create(UserSubscriptionEntity, {
                userId: user.id,
                planId: plan.id,
                subscriptionType: SubscriptionType.ONETIME,
                startDate,
                endDate,
                isActive: true,
                autoRenew: false,
                status: SubscriptionStatus.ACTIVE,
                paidAmount: Number(transaction.amount),
                isTrial: false,
            });
            await queryRunner.manager.save(subscription);

            // Commit transaction
            await queryRunner.commitTransaction();

            this.logger.log(`✅ Payment completed successfully for user ${user.id}, transaction ${click_trans_id}`);
            this.logger.log(`💰 Amount: ${transaction.amount} UZS, Plan: ${plan.name}`);
            this.logger.log(`🎉 User ${user.id} activated with lifetime access until ${endDate.toISOString()}`);

            // Bot orqali foydalanuvchiga xabar berish
            try {
                const bot = this.botService.getBot();
                await bot.api.sendMessage(
                    user.telegramId,
                    `🎉 <b>Tabriklaymiz!</b>\n\n` +
                    `✅ To'lov muvaffaqiyatli amalga oshirildi!\n` +
                    `💰 Summa: ${transaction.amount} so'm\n` +
                    `📦 Reja: ${plan.name}\n\n` +
                    `🌟 <b>Endi siz VIP foydalanuvchisiz!</b>\n` +
                    `♾️ Barcha ismlar manosi umrbod ochiq!\n\n` +
                    `Botdan bemalol foydalanishingiz mumkin! 🚀`,
                    {
                        parse_mode: 'HTML'
                    }
                );
            } catch (notificationError) {
                this.logger.error('Failed to send payment success notification:', notificationError);
            }

            return {
                click_trans_id,
                merchant_trans_id,
                merchant_confirm_id: merchant_prepare_id,
                error: 0,
                error_note: 'Success'
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`❌ Error in completeTransaction: ${error.message}`, error.stack);
            return {
                click_trans_id,
                merchant_trans_id,
                merchant_confirm_id: null,
                error: -1,
                error_note: 'Internal error'
            };
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Click sign string'ini tekshirish
     */
    private verifySignature(clickReqBody: any): boolean {
        const {
            click_trans_id,
            service_id,
            merchant_trans_id,
            amount,
            action,
            sign_time,
            sign_string,
            merchant_prepare_id,
        } = clickReqBody;

        // Sign string generatsiya qilish
        let signKey: string;
        if (action == 0) {
            // PREPARE
            signKey = [
                click_trans_id,
                service_id,
                this.clickSecretKey,
                merchant_trans_id,
                amount,
                action,
                sign_time
            ].join('');
        } else {
            // COMPLETE
            signKey = [
                click_trans_id,
                service_id,
                this.clickSecretKey,
                merchant_trans_id,
                merchant_prepare_id,
                amount,
                action,
                sign_time
            ].join('');
        }

        const generatedSignString = createHash('md5').update(signKey).digest('hex');

        this.logger.log(`Generated sign: ${generatedSignString}, Received sign: ${sign_string}`);

        return generatedSignString === sign_string;
    }
}
