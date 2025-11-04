import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { config } from '../../shared/config';
import { NameMeaningService } from './services/name-meaning.service';
import logger from '../../shared/utils/logger';
import { UserEntity } from '../../shared/database/entities/user.entity';
import { PlanEntity } from '../../shared/database/entities/plan.entity';
import { generateClickOnetimeLink } from '../../shared/generators/click-onetime-link.generator';

interface SessionData {
  mainMenuMessageId?: number;
  pendingOnetimePlanId?: string;
}

type BotContext = Context & SessionFlavor<SessionData>;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Bot<BotContext>;
  private nameMeaningService: NameMeaningService;
  private readonly ADMIN_IDS = [1487957834, 7554617589, 85939027, 2022496528];

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {
    this.bot = new Bot<BotContext>(config.BOT_TOKEN);
    this.nameMeaningService = new NameMeaningService();
    this.setupMiddleware();
    this.setupHandlers();
  }

  async onModuleInit(): Promise<void> {
    this.startAsync();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  public async start(): Promise<void> {
    await this.bot.start({
      allowed_updates: [
        'message',
        'callback_query',
      ],
      onStart: () => {
        logger.info('Bot started');
      },
    });
  }

  public async stop(): Promise<void> {
    logger.info('Stopping bot...');
    await this.bot.stop();
  }

  private async startAsync(): Promise<void> {
    try {
      await this.start();
    } catch (error) {
      logger.error('Failed to start bot:', error);
    }
  }

  private setupMiddleware(): void {
    this.bot.use(
      session({
        initial: (): SessionData => ({}),
      }),
    );
  }

  private setupHandlers(): void {
    this.bot.command('start', this.handleStart.bind(this));
    this.bot.command('admin', this.handleAdminCommand.bind(this));
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    this.bot.on('message', this.handleMessage.bind(this));
  }

  private async handleCallbackQuery(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) return;

    const data = ctx.callbackQuery.data;

    // Handle onetime payment provider selection
    if (data.startsWith('onetime|')) {
      const [, provider] = data.split('|');
      if (provider === 'uzcard' || provider === 'payme' || provider === 'click') {
        await this.handleOneTimePaymentProviderSelection(ctx, provider as 'uzcard' | 'payme' | 'click');
      }
      return;
    }

    const handlers: { [key: string]: (ctx: BotContext) => Promise<void> } = {
      name_meaning: this.handleNameMeaningRequest.bind(this),
      onetime_payment: this.handleOneTimePayment.bind(this),
      main_menu: this.showMainMenu.bind(this),
    };

    const handler = handlers[data];
    if (handler) {
      await handler(ctx);
    }
  }

  private async showMainMenu(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id;
    let user = null;

    if (telegramId) {
      user = await this.userRepository.findOne({
        where: { telegramId }
      });
    }

    // Check if user has paid (has active subscription or subscriptionEnd date)
    const hasPaid = user && (user.isActive || user.subscriptionEnd);

    const keyboard = new InlineKeyboard()
      .text("🌟 Ism manosi", 'name_meaning');

    // Only show payment button if user hasn't paid
    if (!hasPaid) {
      keyboard.row().text("💳 Bir martalik to'lov", 'onetime_payment');
    }

    let message = `Assalomu alaykum, ${ctx.from?.first_name}! 👋\n\n🌟 Ismlar manosi botiga xush kelibsiz!\n\n💫 Bu bot orqali siz har qanday ismning manosini bila olasiz.\n\n`;

    if (hasPaid) {
      message += `✅ Siz to'lov qilgansiz! Botdan cheksiz foydalaning.\n\n`;
    } else {
      message += `💳 Bir martalik to'lov qiling va umrbod bepul foydalaning!\n💵 Narx: 5555 so'm\n\n`;
    }

    message += `Quyidagi tugmalardan birini tanlang yoki ismni yozing:`;

    const chatId = ctx.chat?.id;

    if (!ctx.callbackQuery && chatId && ctx.session.mainMenuMessageId) {
      try {
        await ctx.api.deleteMessage(chatId, ctx.session.mainMenuMessageId);
      } catch (error) {
        logger.warn('Old menu message could not be deleted', {
          chatId,
          messageId: ctx.session.mainMenuMessageId,
          error,
        });
      }
    }

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });
        const messageId = ctx.callbackQuery.message?.message_id;
        if (messageId) {
          ctx.session.mainMenuMessageId = messageId;
        }
      } catch (error) {
        logger.warn('Failed to edit main menu message, sending new message', {
          error,
        });
        if (chatId) {
          const sentMessage = await ctx.reply(message, {
            reply_markup: keyboard,
            parse_mode: 'HTML',
          });
          ctx.session.mainMenuMessageId = sentMessage.message_id;
        }
      }
      return;
    }

    const sentMessage = await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
    ctx.session.mainMenuMessageId = sentMessage.message_id;
  }

  private async handleStart(ctx: BotContext): Promise<void> {
    const chatId = ctx.chat?.id;
    const messageId = ctx.message?.message_id;

    if (chatId && messageId) {
      try {
        await ctx.api.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.warn('Start command message could not be deleted', {
          chatId,
          messageId,
          error,
        });
      }

      await this.clearChatHistory(ctx, messageId);
    } else {
      await this.clearChatHistory(ctx);
    }

    ctx.session.mainMenuMessageId = undefined;

    await this.createUserIfNotExist(ctx);
    await this.showMainMenu(ctx);
  }

  private async clearChatHistory(
    ctx: BotContext,
    startMessageId?: number,
  ): Promise<void> {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const messagesToDelete = 50;
    const endMessageId = startMessageId || ctx.session.mainMenuMessageId;

    if (!endMessageId) return;

    const deletePromises = [];
    for (let i = 0; i < messagesToDelete; i++) {
      const messageIdToDelete = endMessageId - i;
      if (messageIdToDelete > 0) {
        deletePromises.push(
          ctx.api
            .deleteMessage(chatId, messageIdToDelete)
            .catch(() => { }),
        );
      }
    }

    await Promise.all(deletePromises);
  }

  private async createUserIfNotExist(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!telegramId) return;

    try {
      let user = await this.userRepository.findOne({
        where: { telegramId }
      });

      if (!user) {
        user = this.userRepository.create({
          telegramId,
          username,
          firstName,
          lastName,
        });
        await this.userRepository.save(user);
        logger.info(`New user created: ${telegramId}`);
      }
    } catch (error) {
      logger.error('Error creating/finding user:', error);
    }
  }

  private async handleAdminCommand(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId || !this.ADMIN_IDS.includes(telegramId)) {
      await ctx.reply('⛔ Sizda admin huquqi yo\'q.');
      return;
    }

    try {
      const totalUsers = await this.userRepository.count();
      const activeUsers = await this.userRepository.count({
        where: { isActive: true }
      });

      await ctx.reply(
        `📊 Bot statistikasi:\n\n` +
        `👥 Jami foydalanuvchilar: ${totalUsers}\n` +
        `✅ Faol foydalanuvchilar: ${activeUsers}`,
      );
    } catch (error) {
      logger.error('Admin command error:', error);
      await ctx.reply('❌ Statistikani olishda xatolik yuz berdi.');
    }
  }

  private async handleNameMeaningRequest(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('🔙 Asosiy menyu', 'main_menu');

    const message = `🌟 Ism manosi\n\nIltimos, manosi haqida bilmoqchi bo'lgan ismni yozing:\n\n💡 Masalan: Kamoliddin, Oisha, Muhammad va h.k.`;

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  private async handleMessage(ctx: BotContext): Promise<void> {
    const messageText = ctx.message?.text?.trim();

    if (!messageText || messageText.startsWith('/')) {
      return;
    }

    await this.createUserIfNotExist(ctx);

    if (this.nameMeaningService.isValidName(messageText)) {
      await this.processNameMeaning(ctx, messageText);
    } else {
      await this.showNameInputHelp(ctx, messageText);
    }
  }

  private async processNameMeaning(ctx: BotContext, name: string): Promise<void> {
    await ctx.replyWithChatAction('typing');

    try {
      // Check if user has paid
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        return;
      }

      const user = await this.userRepository.findOne({
        where: { telegramId }
      });

      // Foydalanuvchi VIP ekanligini tekshirish
      const hasPaid = user && user.isActive && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date();

      if (!hasPaid) {
        // User hasn't paid - show payment button
        const keyboard = new InlineKeyboard()
          .text("💳 To'lov qilish", 'onetime_payment')
          .row()
          .text('🔙 Asosiy menyu', 'main_menu');

        await ctx.reply(
          `🔒 <b>Ism manosini ko'rish uchun to'lov qiling</b>\n\n` +
          `💵 Narx: 5555 so'm\n` +
          `♾️ Bir marta to'lov - umrbod foydalaning!\n\n` +
          `To'lov qilganingizdan so'ng barcha ismlar manosi ochiladi.`,
          {
            reply_markup: keyboard,
            parse_mode: 'HTML'
          }
        );
        return;
      }

      // User has paid - show name meaning
      const result = await this.nameMeaningService.getNameMeaning(name);

      const keyboard = new InlineKeyboard()
        .text('🌟 Boshqa ism', 'name_meaning')
        .row()
        .text('🔙 Asosiy menyu', 'main_menu');

      if (result.meaning) {
        const formattedMessage = this.nameMeaningService.formatNameMeaning(name, result.meaning);
        await ctx.reply(formattedMessage, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });
      } else {
        await ctx.reply(
          `❌ ${name} ismi haqida ma'lumot topilmadi.\n\n🔍 Boshqa ism bilan urinib ko'ring.`,
          { reply_markup: keyboard }
        );
      }
    } catch (error) {
      logger.error('Name meaning processing error:', error);

      const keyboard = new InlineKeyboard()
        .text('🔄 Qayta urinish', 'name_meaning')
        .row()
        .text('🔙 Asosiy menyu', 'main_menu');

      await ctx.reply(
        '⚠️ Ism manosi olishda xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.',
        { reply_markup: keyboard }
      );
    }
  }

  private async showNameInputHelp(ctx: BotContext, input: string): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('🌟 Ism manosi', 'name_meaning')
      .row()
      .text('🔙 Asosiy menyu', 'main_menu');

    let message = '❓ Noto\'g\'ri format!\n\n';

    if (input.length > 50) {
      message += '📝 Ism juda uzun bo\'ldi. Iltimos, qisqaroq kiriting.';
    } else if (!/^[a-zA-ZА-Яа-яЁёўўҳҳғғқққ\s]+$/u.test(input)) {
      message += '📝 Iltimos, faqat harflardan iborat ism kiriting.';
    } else {
      message += '📝 Iltimos, to\'g\'ri ism kiriting.';
    }

    message += '\n\n💡 Masalan: Kamoliddin, Oisha, Muhammad';

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  private async handleOneTimePayment(ctx: BotContext): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.answerCallbackQuery('Foydalanuvchi ID topilmadi.');
        return;
      }

      const user = await this.userRepository.findOne({
        where: { telegramId }
      });

      // Check if user already paid (VIP)
      if (user && user.isActive && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date()) {
        await ctx.answerCallbackQuery({
          text: '✅ Siz allaqachon VIP foydalanuvchisiz! Botdan umrbod bepul foydalanishingiz mumkin.',
          show_alert: true,
        } as any);
        return;
      }

      const plan = await this.planRepository.findOne({
        where: { name: 'Basic' }
      });
      if (!plan) {
        await ctx.answerCallbackQuery('To\'lov rejasi topilmadi.');
        return;
      }

      ctx.session.pendingOnetimePlanId = plan.id;

      const keyboard = new InlineKeyboard()
        .text("💳 UzCard", 'onetime|uzcard')
        .text("🟢 Click", 'onetime|click')
        .row()
        .text("💙 Payme", 'onetime|payme')
        .row()
        .text("🔙 Asosiy menyu", 'main_menu');

      await ctx.editMessageText(
        "💰 <b>Bir martalik to'lov - Umrbod foydalanish!</b>\n\n" +
        `💵 Narx: ${plan.price} so'm\n` +
        `♾️ Muddati: Umrbod!\n\n` +
        "✅ Bir marta to'lov qiling va butun umr bepul foydalaning!\n\n" +
        "Iltimos, o'zingizga ma'qul to'lov turini tanlang:",
        {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        }
      );
    } catch (error) {
      logger.error('One-time payment error:', error);
      await ctx.answerCallbackQuery('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  }

  private async handleOneTimePaymentProviderSelection(
    ctx: BotContext,
    provider: 'uzcard' | 'payme' | 'click'
  ): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.answerCallbackQuery('Foydalanuvchi ID topilmadi.');
        return;
      }

      const user = await this.userRepository.findOne({
        where: { telegramId }
      });
      if (!user) {
        await ctx.answerCallbackQuery('Foydalanuvchi topilmadi.');
        return;
      }

      const planId = ctx.session.pendingOnetimePlanId;
      if (!planId) {
        await ctx.answerCallbackQuery('To\'lov rejasi topilmadi.');
        return;
      }

      const plan = await this.planRepository.findOne({
        where: { id: planId }
      });
      if (!plan) {
        await ctx.answerCallbackQuery('To\'lov rejasi topilmadi.');
        return;
      }

      let paymentLink = '';
      const userId = user.id;

      if (provider === 'click') {
        paymentLink = generateClickOnetimeLink(
          planId,
          userId,
          plan.price
        );
      } else if (provider === 'payme') {
        const { generatePaymeLink } = await import('../../shared/generators/payme-link.generator');
        paymentLink = generatePaymeLink({
          planId: planId,
          userId: userId,
          amount: plan.price,
        });
      } else if (provider === 'uzcard') {
        paymentLink = `${config.BASE_URL}/api/uzcard-onetime-api/onetime-payment?userId=${userId}&planId=${planId}`;
      }

      const keyboard = new InlineKeyboard()
        .url("💳 To'lovga o'tish", paymentLink)
        .row()
        .text("🔙 Asosiy menyu", 'main_menu');

      const providerNames = {
        click: 'Click',
        payme: 'Payme',
        uzcard: 'UzCard'
      };

      await ctx.editMessageText(
        `💳 <b>${providerNames[provider]} orqali to'lov</b>\n\n` +
        `💵 Summa: ${plan.price} so'm\n` +
        `♾️ Muddati: Umrbod!\n\n` +
        `✅ Bir marta to'lov qiling va butun umr bepul foydalaning!\n\n` +
        `Quyidagi tugmani bosib to'lovni amalga oshiring:`,
        {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        }
      );
    } catch (error) {
      logger.error('Payment provider selection error:', error);
      await ctx.answerCallbackQuery('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  }

  // Keep bot getter for external access
  public getBot(): Bot<BotContext> {
    return this.bot;
  }
}
