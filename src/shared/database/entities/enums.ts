// User enums
export enum SubscriptionType {
    SUBSCRIPTION = 'subscription',
    ONETIME = 'onetime',
}

// Transaction enums
export enum PaymentProvider {
    PAYME = 'payme',
    UZUM = 'uzum',
    CLICK = 'click',
    UZCARD = 'uzcard',
}

export enum PaymentType {
    SUBSCRIPTION = 'subscription',
    ONETIME = 'onetime',
}

export enum TransactionStatus {
    PENDING = 'PENDING',
    CREATED = 'CREATED',
    PAID = 'PAID',
    CANCELED = 'CANCELED',
    FAILED = 'FAILED',
}

// Card enums
export enum CardType {
    UZCARD = 'uzcard',
    CLICK = 'click',
    PAYME = 'payme',
}

export enum SubscribedTo {
    FOOTBALL = 'football',
    WRESTLING = 'wrestling',
}

// Subscription enums
export enum SubscriptionStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
    PENDING = 'pending',
}

// Payment enums
export enum PaymentStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
}
