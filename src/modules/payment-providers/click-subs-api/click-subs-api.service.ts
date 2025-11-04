import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import axios from 'axios';
import { UserEntity, PlanEntity, TransactionEntity, UserCardEntity, UserSubscriptionEntity } from 'src/shared/database/entities';
import { PaymentProvider, PaymentType, TransactionStatus, CardType, SubscriptionType, SubscriptionStatus } from 'src/shared/database/entities/enums';
import { clickAuthHash } from 'src/shared/utils/hashing/click-auth-hash';
import logger from 'src/shared/utils/logger';
import { PaymentCardTokenDto } from 'src/shared/utils/types/interfaces/payme-types';
import { CreateCardTokenDto } from './dto/create-card-dto';
import { VerifyCardTokenDto } from './dto/verif-card-dto';
import { CreateCardTokenResponseDto } from 'src/shared/utils/types/interfaces/click-types-interface';
import { BotService } from 'src/modules/bot/bot.service';

@Injectable()
export class ClickSubsApiService {

    private readonly serviceId = process.env.CLICK_SERVICE_ID;
    private readonly baseUrl = 'https://api.click.uz/v2/merchant';

    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        @InjectRepository(PlanEntity)
        private readonly planRepository: Repository<PlanEntity>,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        @InjectRepository(UserCardEntity)
        private readonly userCardRepository: Repository<UserCardEntity>,
        @InjectRepository(UserSubscriptionEntity)
        private readonly userSubscriptionRepository: Repository<UserSubscriptionEntity>,
    ) { }


    async createCardtoken(requestBody: CreateCardTokenDto) {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': clickAuthHash()
        };

        interface RequestBody {
            service_id: string,
            card_number: string,
            expire_date: string,
            temporary: boolean,
        }

        if (!this.serviceId) {
            throw new Error('Service ID is not defined');
        }
        const requestBodyWithServiceId: RequestBody = {
            service_id: this.serviceId,
            card_number: requestBody.card_number,
            expire_date: requestBody.expire_date,
            temporary: requestBody.temporary
        };

        try {

            console.log("Request data:", requestBodyWithServiceId);
            const response = await axios.post(
                `${this.baseUrl}/card_token/request`,
                requestBodyWithServiceId,
                { headers }
            );

            console.log("Received response data:", response.data);

            if (response.data.error_code !== 0) {
                throw new Error("Response error code is not 0");
            }
            const result: CreateCardTokenResponseDto = new CreateCardTokenResponseDto();


            result.token = response.data.card_token;
            result.incompletePhoneNumber = response.data.phone_number;

            return result;
        } catch (error) {
            // Handle errors appropriately
            console.error('Error creating card token:', error);
            throw error;
        }
    }

    async verifyCardToken(requestBody: VerifyCardTokenDto) {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': clickAuthHash()
        };

        interface RequestBody {

            service_id: string
            card_token: string,
            sms_code: number,
        }

        if (!this.serviceId) {
            throw new Error('Service ID is not defined');
        }

        const requestBodyWithServiceId: RequestBody = {
            service_id: this.serviceId,
            card_token: requestBody.card_token,
            sms_code: requestBody.sms_code
        };


        try {
            const response = await axios.post(
                `${this.baseUrl}/card_token/verify`, // Changed endpoint to verify
                requestBodyWithServiceId,
                { headers }
            );


            if (response.data.error_code !== 0) {
                throw new Error(`Verification failed: ${response.data.error_message || 'Unknown error'}`);
            }

            const user = await this.userRepository.findOne({
                where: { id: requestBody.userId },
            });


            if (!user) {
                logger.error(`User not found for ID: ${requestBody.userId}`);
                throw new Error('User not found');
            }
            logger.info(`User found: ${user}`);


            const plan = await this.planRepository.findOne({
                where: { id: requestBody.planId }
            });
            if (!plan) {
                logger.error(`Plan not found for ID: ${requestBody.planId}`);
                throw new Error('Plan not found');
            }

            console.log(plan)


            const time = new Date().getTime();
            logger.info(`Creating user card for user ID: ${requestBody.userId}, with card token: ${requestBody.card_token}`);

            // Check if user already has a card and update it, otherwise create new one
            const existingCard = await this.userCardRepository.findOne({
                where: {
                    telegramId: user.telegramId,
                    cardType: CardType.CLICK
                }
            });

            let userCard;
            if (existingCard) {
                existingCard.incompleteCardNumber = response.data.card_number;
                existingCard.cardToken = requestBodyWithServiceId.card_token;
                existingCard.expireDate = requestBody.expireDate;
                existingCard.planId = requestBody.planId;
                existingCard.verificationCode = requestBody.sms_code;
                existingCard.verified = true;
                existingCard.verifiedDate = new Date(time);
                existingCard.isDeleted = false;
                existingCard.deletedAt = null;
                userCard = await this.userCardRepository.save(existingCard);
            } else {
                // Create new card
                const newCard = this.userCardRepository.create({
                    telegramId: Number(user.telegramId),
                    username: user.username ? user.username : undefined,
                    incompleteCardNumber: response.data.card_number,
                    cardToken: requestBodyWithServiceId.card_token,
                    expireDate: requestBody.expireDate,
                    userId: requestBody.userId,
                    planId: requestBody.planId,
                    verificationCode: requestBody.sms_code,
                    verified: true,
                    verifiedDate: new Date(time),
                    cardType: CardType.CLICK
                });
                userCard = await this.userCardRepository.save(newCard);
            }

            // No need to update subscriptionType here
            // user.subscriptionType = 'basic';
            // await this.userRepository.save(user);

            const hasUsedTrial = Boolean(user.hasReceivedFreeBonus);
            const duration = Number(plan.duration) || 30;
            const responsePayload = {
                success: true,
                trialActivated: !hasUsedTrial,
                message: !hasUsedTrial
                    ? '30 kunlik bepul obuna faollashtirildi.'
                    : 'Tekin sinov muddati avval faollashtirilgan. Obuna pullik rejimda davom ettirildi.',
                result: response.data,
            };

            if (!hasUsedTrial) {
                const now = new Date();
                const endDate = new Date(now);
                endDate.setDate(endDate.getDate() + duration);

                const newSubscription = this.userSubscriptionRepository.create({
                    userId: requestBody.userId,
                    planId: requestBody.planId,
                    subscriptionType: SubscriptionType.SUBSCRIPTION,
                    startDate: now,
                    endDate,
                    isActive: true,
                    autoRenew: true,
                    status: SubscriptionStatus.ACTIVE,
                    paidAmount: 0,
                    isTrial: true,
                });
                await this.userSubscriptionRepository.save(newSubscription);

                if (requestBody.selectedService === 'yulduz') {
                    // TODO: Handle bot notification
                    logger.info('Trial subscription activated for user', { userId: requestBody.userId });
                }

                return responsePayload;
            }

            if (requestBody.selectedService === 'yulduz') {
                try {
                    // TODO: Handle bot notification for card added without bonus
                    logger.info('Card added without bonus for user', { userId: requestBody.userId });
                } catch (botError) {
                    logger.error(
                        `Failed to trigger paid renewal for CLICK user ${user.telegramId}:`,
                        botError,
                    );
                    return {
                        success: false,
                        trialActivated: false,
                        message: "Kartangiz saqlandi, ammo pullik obunani faollashtirishda muammo yuz berdi. Iltimos qaytadan urinib ko'ring."
                    };
                }
            }

            return responsePayload;
        } catch (error) {
            console.error('Error verifying card token:', error);
            throw error;
        }


    }


    async paymentWithToken(requestBody: PaymentCardTokenDto) {
        const userCard = await this.userCardRepository.findOne({
            where: {
                userId: requestBody.userId,
                telegramId: requestBody.telegramId,
                verified: true,
                cardType: CardType.CLICK,
                isDeleted: Not(true),
            }
        });

        if (!userCard || !this.serviceId) {
            return { success: false };
        }

        if (userCard.cardType !== CardType.CLICK) {
            logger.error(`Card type is not CLICK for User ID: ${requestBody.userId}`);
            return {
                success: false,
            }
        }

        const plan = await this.planRepository.findOne({ where: { id: requestBody.planId } });
        if (!plan) {
            logger.error('Plan not found');
            return {
                success: false,
            }
        }

        const headers = this.getHeaders();

        const payload = {
            service_id: this.serviceId,
            card_token: userCard.cardToken,
            amount: "5555",
            transaction_parameter: "67a35e3f20d13498efcac2f0",
            transaction_param3: requestBody.userId,
            transaction_param4: "merchant" // test this later
        };

        try {
            const response = await axios.post(
                `${this.baseUrl}/card_token/payment`,
                payload,
                { headers });


            const { error_code } = response.data;

            logger.error(`Error code from response: ${error_code}`);

            if (error_code === -5017) {
                // Handle insufficient funds case
                logger.error(`Insufficient funds for user ID: ${requestBody.userId}`);
                return { success: false };
            }

            const paymentId = response.data.payment_id;

            const customRandomId = `subscription-click-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;


            const transaction = this.transactionRepository.create({
                provider: PaymentProvider.CLICK,
                transId: paymentId ? paymentId : customRandomId,
                amount: 5555,
                status: TransactionStatus.PAID,
                userId: requestBody.userId,
                planId: requestBody.planId,
            });
            await this.transactionRepository.save(transaction);

            logger.info(`Transaction created in click-subs-api: ${JSON.stringify(transaction)}`);


            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);

            const newSubscription = this.userSubscriptionRepository.create({
                userId: requestBody.userId,
                planId: requestBody.planId,
                subscriptionType: SubscriptionType.SUBSCRIPTION,
                startDate: new Date(),
                endDate: endDate,
                isActive: true,
                autoRenew: true,
                status: SubscriptionStatus.ACTIVE,
                paidAmount: plan.price,
            });
            await this.userSubscriptionRepository.save(newSubscription);

            logger.info(`UserSubscription created for user ID: ${requestBody.userId}, telegram ID: ${requestBody.telegramId}, plan ID: ${requestBody.planId} in click-subs-api`);


            return { success: true };

        } catch {
            return { success: false };
        }


    }

    private getHeaders() {
        return {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': clickAuthHash()
        };
    }

    async deleteCard(cardToken: string): Promise<boolean> {
        if (!this.serviceId) {
            logger.error('Service ID is not configured for Click card deletion');
            return false;
        }

        try {
            const response = await axios.delete(
                `${this.baseUrl}/card_token/${this.serviceId}/${encodeURIComponent(cardToken)}`,
                { headers: this.getHeaders() }
            );

            if (response.data?.error_code === 0) {
                return true;
            }

            logger.error(
                `Failed to delete Click card. Response: ${JSON.stringify(response.data)}`
            );
            return false;
        } catch (error) {
            logger.error('Error deleting Click card:', error);
            return false;
        }
    }

}
