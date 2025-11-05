import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { InlineQueryResultArticle } from 'grammy/types';
import { config } from '../../shared/config';
import logger from '../../shared/utils/logger';
import { UserEntity } from '../../shared/database/entities/user.entity';
import { PlanEntity } from '../../shared/database/entities/plan.entity';
import { generateClickOnetimeLink } from '../../shared/generators/click-onetime-link.generator';
import { NameMeaningService } from './services/name-meaning.service';
import {
  NameInsightsService,
  QuizQuestion,
  TrendGender,
  TrendPeriod,
} from './services/name-insights.service';
import { UserFavoritesService } from './services/user-favorites.service';
import { UserPersonaService } from './services/user-persona.service';
import { TargetGender } from '../../shared/database/entities/user-persona-profile.entity';

type FlowName = 'personalization' | 'quiz';

interface FlowState {
  name: FlowName;
  step: number;
  payload: Record<string, any>;
}

interface SessionData {
  mainMenuMessageId?: number;
  pendingOnetimePlanId?: string;
  flow?: FlowState;
  favoritesPage?: number;
  quizAnswers?: Record<string, string>;
  quizTags?: string[];
}

type BotContext = Context & SessionFlavor<SessionData>;

const PERSONAL_FOCUS_TAGS: Array<{ key: string; label: string; tag: string }> = [
  { key: 'ramziy', label: 'Ramziy', tag: 'ramziy' },
  { key: 'rahbar', label: 'Rahbariy', tag: 'rahbar' },
  { key: 'manaviy', label: 'Ma\'naviy', tag: 'ma\'naviy' },
  { key: 'zamonaviy', label: 'Zamonaviy', tag: 'zamonaviy' },
  { key: 'tabiat', label: 'Tabiat', tag: 'tabiat' },
  { key: 'ilhom', label: 'Ilhom', tag: 'ilhom' },
];

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly ADMIN_IDS = [1487957834, 7554617589, 85939027, 2022496528];
  private readonly quizFlow: QuizQuestion[];
  private bot: Bot<BotContext>;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
    private readonly nameMeaningService: NameMeaningService,
    private readonly insightsService: NameInsightsService,
    private readonly favoritesService: UserFavoritesService,
    private readonly personaService: UserPersonaService,
  ) {
    this.bot = new Bot<BotContext>(config.BOT_TOKEN);
    this.quizFlow = this.insightsService.getQuizFlow();
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
        'inline_query',
      ],
      onStart: () => logger.info('Bot started'),
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
    this.bot.on('inline_query', this.handleInlineQuery.bind(this));
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    this.bot.on('message', this.handleMessage.bind(this));
  }

  private buildMainMenuKeyboard(hasPaid: boolean): InlineKeyboard {
    const keyboard = new InlineKeyboard()
      .text('🌟 Ism ma\'nosi', 'name_meaning')
      .text('🎯 Shaxsiy tavsiya', 'menu:personal')
      .row()
      .text('🧭 Kategoriya filterlari', 'menu:filters')
      .text('🧪 Mini test', 'quiz:start')
      .row()
      .text('📈 Trendlar', 'menu:trends')
      .text('⭐ Sevimlilar', 'fav:list:1')
      .row()
      .text('🌍 Jamiyat', 'menu:community')
      .text('💬 Fikr bildirish', 'menu:feedback')
      .row()
      .switchInline('🔍 Inline qidiruv', '');

    if (!hasPaid) {
      keyboard.row().text('💳 Bir martalik to\'lov', 'onetime_payment');
    }

    return keyboard;
  }

  private async handleCallbackQuery(ctx: BotContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith('onetime|')) {
      const [, provider] = data.split('|');
      if (provider === 'uzcard' || provider === 'payme' || provider === 'click') {
        await this.handleOneTimePaymentProviderSelection(ctx, provider as 'uzcard' | 'payme' | 'click');
      }
      return;
    }

    const [namespace, ...parts] = data.split(':');

    switch (namespace) {
      case 'menu':
        await this.handleMenuNavigation(ctx, parts);
        break;
      case 'filter':
        await this.handleFilterActions(ctx, parts);
        break;
      case 'quiz':
        await this.handleQuizCallbacks(ctx, parts);
        break;
      case 'fav':
        await this.handleFavoriteCallbacks(ctx, parts);
        break;
      case 'personal':
        await this.handlePersonalizationCallbacks(ctx, parts);
        break;
      case 'name':
        await this.handleNameCallbacks(ctx, parts);
        break;
      case 'trend':
        await this.handleTrendCallbacks(ctx, parts);
        break;
      case 'community':
        await this.handleCommunityCallbacks(ctx, parts);
        break;
      default:
        await this.handleLegacyCallback(ctx, data);
        break;
    }
  }

  private async handleLegacyCallback(ctx: BotContext, data: string): Promise<void> {
    const handlers: { [key: string]: (ctx: BotContext) => Promise<void> } = {
      name_meaning: this.handleNameMeaningRequest.bind(this),
      onetime_payment: this.handleOneTimePayment.bind(this),
      main_menu: this.showMainMenu.bind(this),
    };

    const handler = handlers[data];
    if (handler) {
      await handler(ctx);
    }
    await ctx.answerCallbackQuery();
  }

  private async handleMenuNavigation(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    switch (action) {
      case 'personal':
        await this.startPersonalizationFlow(ctx);
        break;
      case 'filters':
        await this.showCategoryFilterMenu(ctx);
        break;
      case 'trends':
        await this.showTrendMenu(ctx);
        break;
      case 'community':
        await this.showCommunityMenu(ctx);
        break;
      case 'feedback':
        await ctx.answerCallbackQuery({
          text: '📬 Fikr va takliflaringizni @ism_support kanaliga yozib qoldiring.',
          show_alert: true,
        } as any);
        break;
      default:
        await this.showMainMenu(ctx);
        break;
    }
  }

  private async handleFilterActions(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    if (action !== 'combo') {
      await ctx.answerCallbackQuery();
      return;
    }

    const comboKey = parts[1];
    const gender = (parts[2] as TrendGender) || 'all';
    await this.showCategorySuggestions(ctx, comboKey, gender);
  }

  private async handleQuizCallbacks(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    if (action === 'start') {
      await this.startQuiz(ctx);
      return;
    }

    if (action === 'answer') {
      const questionId = parts[1];
      const value = parts[2];
      await this.processQuizAnswer(ctx, questionId, value);
    }
  }

  private async handleFavoriteCallbacks(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    if (action === 'list') {
      const page = parseInt(parts[1] || '1', 10);
      await this.showFavoriteNames(ctx, page);
      return;
    }

    if (action === 'toggle') {
      const slug = parts[1];
      await this.toggleFavorite(ctx, slug);
    }
  }

  private async handlePersonalizationCallbacks(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    if (!ctx.session.flow || ctx.session.flow.name !== 'personalization') {
      ctx.session.flow = {
        name: 'personalization',
        step: 1,
        payload: { focusValues: [] },
      };
    }

    switch (action) {
      case 'gender': {
        const gender = parts[1] as TrendGender;
        ctx.session.flow.step = 2;
        ctx.session.flow.payload.targetGender = gender;
        await ctx.editMessageText(
          '🍼 Kutilayotgan tug\'ilish sanasini kiriting.\n\nFormat: <b>YYYY-MM-DD</b>\nAgar aniq sanani bilmasangiz <i>skip</i> deb yozing.',
          { parse_mode: 'HTML' },
        );
        break;
      }
      case 'focus': {
        const key = parts[1];
        if (key === 'done') {
          await this.finalizePersonalization(ctx);
        } else if (key === 'reset') {
          ctx.session.flow = {
            name: 'personalization',
            step: 1,
            payload: { focusValues: [] },
          };
          await this.startPersonalizationFlow(ctx);
        } else {
          const payload = ctx.session.flow.payload;
          const current: string[] = payload.focusValues || [];
          if (current.includes(key)) {
            payload.focusValues = current.filter((item) => item !== key);
          } else {
            payload.focusValues = [...current, key];
          }
          await this.promptFocusSelection(ctx);
        }
        break;
      }
      default:
        await this.startPersonalizationFlow(ctx);
    }
  }

  private async handleNameCallbacks(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    const slug = parts[1];

    switch (action) {
      case 'detail':
        await this.showNameDetail(ctx, slug);
        break;
      case 'similar':
        await this.showSimilarNames(ctx, slug);
        break;
      case 'translate':
        await this.showTranslations(ctx, slug);
        break;
      case 'audio':
        await this.sendAudioPreview(ctx, slug);
        break;
      case 'trend':
        await this.showNameTrend(ctx, slug);
        break;
      default:
        await ctx.answerCallbackQuery();
    }
  }

  private async handleTrendCallbacks(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    if (action === 'overview') {
      const period = (parts[1] as TrendPeriod) || 'monthly';
      const gender = (parts[2] as TrendGender) || 'all';
      await this.showTrendOverview(ctx, period, gender);
    }
  }

  private async handleCommunityCallbacks(ctx: BotContext, parts: string[]): Promise<void> {
    const action = parts[0];
    switch (action) {
      case 'poll': {
        const poll = this.insightsService.getCommunityPoll();
        await ctx.replyWithPoll(poll.question, poll.options, { is_anonymous: false });
        break;
      }
      case 'share': {
        await ctx.answerCallbackQuery({
          text: 'Inline qidiruvni ishga tushirish uchun har qanday chatda @bot_username yozib ismni qidiring.',
          show_alert: true,
        } as any);
        break;
      }
      default:
        await this.showCommunityMenu(ctx);
    }
  }

  private async handleMessage(ctx: BotContext): Promise<void> {
    const messageText = ctx.message?.text?.trim();

    if (!messageText || messageText.startsWith('/')) {
      return;
    }

    if (await this.tryHandleFlowMessage(ctx, messageText)) {
      return;
    }

    await this.createUserIfNotExist(ctx);

    if (this.nameMeaningService.isValidName(messageText)) {
      await this.processNameMeaning(ctx, messageText);
    } else {
      await this.showNameInputHelp(ctx, messageText);
    }
  }

  private async tryHandleFlowMessage(ctx: BotContext, message: string): Promise<boolean> {
    const flow = ctx.session.flow;
    if (!flow) {
      return false;
    }

    if (flow.name === 'personalization') {
      await this.handlePersonalizationMessageInput(ctx, message);
      return true;
    }

    return false;
  }

  private async handleInlineQuery(ctx: BotContext): Promise<void> {
    const query = ctx.inlineQuery?.query ?? '';
    const cards = this.insightsService.generateInlineCards(query, 12);

    const results: InlineQueryResultArticle[] = cards.map((card) => ({
      type: 'article',
      id: card.id,
      title: card.title,
      description: card.description,
      input_message_content: {
        message_text: card.message,
        parse_mode: 'HTML',
      },
      reply_markup: this.buildNameDetailKeyboard(card.keyboardPayload.slug),
    }));

    await ctx.answerInlineQuery(results, {
      cache_time: 5,
      is_personal: true,
    });
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
    ctx.session.flow = undefined;
    ctx.session.quizAnswers = undefined;
    ctx.session.quizTags = undefined;

    await this.createUserIfNotExist(ctx);
    await this.showMainMenu(ctx);
  }

  private async showMainMenu(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id;
    let user: UserEntity | null = null;

    if (telegramId) {
      user = await this.userRepository.findOne({
        where: { telegramId },
      });
    }

    const hasPaid = this.userHasActiveAccess(user);
    const keyboard = this.buildMainMenuKeyboard(hasPaid);

    let message = `Assalomu alaykum, ${ctx.from?.first_name ?? 'do\'st'}! 👋\n\n`;
    message += '🌟 Ismlar manosi botiga xush kelibsiz!\n\n';
    message += 'Bu yerda siz ismlarning ma\'nosi, trendlari, tarjimalari va shaxsiy tavsiyalarni topasiz.\n\n';

    if (hasPaid) {
      message += '✅ Premium foydalanuvchisiz — barcha bo\'limlar ochiq.\n\n';
    } else {
      message += '💳 Bir martalik to\'lov qiling va umrbod to\'liq imkoniyatlarga ega bo\'ling.\nNarx: 5555 so\'m\n\n';
    }

    message += 'Quyidagi bo\'limlardan birini tanlang yoki ismni yozing:';

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
        logger.warn('Failed to edit main menu message, sending new message', { error });
        if (chatId) {
          const sentMessage = await ctx.reply(message, {
            reply_markup: keyboard,
            parse_mode: 'HTML',
          });
          ctx.session.mainMenuMessageId = sentMessage.message_id;
        }
      }
      await ctx.answerCallbackQuery();
      return;
    }

    const sentMessage = await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
    ctx.session.mainMenuMessageId = sentMessage.message_id;
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
    for (let i = 0; i < messagesToDelete; i += 1) {
      const messageIdToDelete = endMessageId - i;
      if (messageIdToDelete > 0) {
        deletePromises.push(
          ctx.api.deleteMessage(chatId, messageIdToDelete).catch(() => undefined),
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
        where: { telegramId },
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

  private userHasActiveAccess(user: UserEntity | null): boolean {
    if (!user) {
      return false;
    }
    if (user.isActive && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date()) {
      return true;
    }
    return false;
  }

  private async ensurePaidAccess(ctx: BotContext): Promise<boolean> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply('Foydalanuvchi aniqlanmadi.');
      return false;
    }

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (this.userHasActiveAccess(user)) {
      return true;
    }

    const keyboard = new InlineKeyboard()
      .text('💳 To\'lov qilish', 'onetime_payment')
      .row()
      .text('🔙 Asosiy menyu', 'main_menu');

    await ctx.reply(
      '🔒 Ushbu bo\'limdan foydalanish uchun bir martalik to\'lov talab qilinadi.\n\n' +
      '💵 Narx: 5555 so\'m\n' +
      '♾️ Umrbod kirish.\n\n' +
      'To\'lovni amalga oshirib, barcha imkoniyatlarni oching.',
      { reply_markup: keyboard },
    );
    return false;
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
        where: { isActive: true },
      });

      await ctx.reply(
        '📊 Bot statistikasi:\n\n' +
        `👥 Jami foydalanuvchilar: ${totalUsers}\n` +
        `✅ Faol foydalanuvchilar: ${activeUsers}`,
      );
    } catch (error) {
      logger.error('Admin command error:', error);
      await ctx.reply('❌ Statistikani olishda xatolik yuz berdi.');
    }
  }

  private async handleNameMeaningRequest(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard().text('🔙 Asosiy menyu', 'main_menu');
    const message =
      '🌟 Ism ma\'nosi\n\n' +
      'Iltimos, ma\'nosi haqida bilmoqchi bo\'lgan ismni yozing:\n\n' +
      '💡 Masalan: Kamoliddin, Oisha, Muhammad va hokazo.';

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  private async processNameMeaning(ctx: BotContext, name: string): Promise<void> {
    await ctx.replyWithChatAction('typing');

    try {
      const hasAccess = await this.ensurePaidAccess(ctx);
      if (!hasAccess) {
        return;
      }

      const { record, meaning } = await this.insightsService.getRichNameMeaning(name);

      if (!record && !meaning) {
        const keyboard = new InlineKeyboard()
          .text('🌟 Boshqa ism', 'name_meaning')
          .row()
          .text('🔙 Asosiy menyu', 'main_menu');

        await ctx.reply(
          `❌ ${name} ismi haqida ma'lumot topilmadi.\n\n🔍 Boshqa ism bilan urinib ko'ring.`,
          { reply_markup: keyboard },
        );
        return;
      }

      const formattedMessage = this.insightsService.formatRichMeaning(
        record?.name ?? name,
        meaning,
        record,
      );

      const slug = record?.slug ?? name.trim().toLowerCase();
      await ctx.reply(formattedMessage, {
        reply_markup: this.buildNameDetailKeyboard(slug),
        parse_mode: 'HTML',
      });
    } catch (error) {
      logger.error('Name meaning processing error:', error);

      const keyboard = new InlineKeyboard()
        .text('🔄 Qayta urinish', 'name_meaning')
        .row()
        .text('🔙 Asosiy menyu', 'main_menu');

      await ctx.reply(
        '⚠️ Ism ma\'nosi olishda xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.',
        { reply_markup: keyboard },
      );
    }
  }

  private async showNameInputHelp(ctx: BotContext, input: string): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('🌟 Ism ma\'nosi', 'name_meaning')
      .row()
      .text('🔙 Asosiy menyu', 'main_menu');

    let message = '❓ Noto\'g\'ri format!\n\n';

    if (input.length > 50) {
      message += '📝 Ism juda uzun bo\'ldi. Iltimos, qisqaroq kiriting.';
    } else if (!/^[a-zA-ZА-Яа-яЁёЎўҚқҒғҲҳ\s]+$/u.test(input)) {
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
        where: { telegramId },
      });

      if (this.userHasActiveAccess(user)) {
        await ctx.answerCallbackQuery({
          text: '✅ Siz allaqachon VIP foydalanuvchisiz! Botdan umrbod bepul foydalanishingiz mumkin.',
          show_alert: true,
        } as any);
        return;
      }

      const plan = await this.planRepository.findOne({
        where: { name: 'Basic' },
      });
      if (!plan) {
        await ctx.answerCallbackQuery('To\'lov rejasi topilmadi.');
        return;
      }

      ctx.session.pendingOnetimePlanId = plan.id;

      const keyboard = new InlineKeyboard()
        .text('💳 UzCard', 'onetime|uzcard')
        .text('🟢 Click', 'onetime|click')
        .row()
        .text('💙 Payme', 'onetime|payme')
        .row()
        .text('🔙 Asosiy menyu', 'main_menu');

      await ctx.editMessageText(
        '💰 <b>Bir martalik to\'lov - Umrbod foydalanish!</b>\n\n' +
        `💵 Narx: ${plan.price} so'm\n` +
        '♾️ Muddati: Umrbod!\n\n' +
        '✅ Bir marta to\'lov qiling va butun umr bepul foydalaning!\n\n' +
        'Iltimos, o\'zingizga ma\'qul to\'lov turini tanlang:',
        {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        },
      );
    } catch (error) {
      logger.error('One-time payment error:', error);
      await ctx.answerCallbackQuery('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  }

  private async handleOneTimePaymentProviderSelection(
    ctx: BotContext,
    provider: 'uzcard' | 'payme' | 'click',
  ): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.answerCallbackQuery('Foydalanuvchi ID topilmadi.');
        return;
      }

      const user = await this.userRepository.findOne({
        where: { telegramId },
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
        where: { id: planId },
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
          plan.price,
        );
      } else if (provider === 'payme') {
        const { generatePaymeLink } = await import('../../shared/generators/payme-link.generator');
        paymentLink = generatePaymeLink({
          planId,
          userId,
          amount: plan.price,
        });
      } else if (provider === 'uzcard') {
        paymentLink = `${config.BASE_URL}/api/uzcard-onetime-api/onetime-payment?userId=${userId}&planId=${planId}&selectedService=${plan.selectedName}`;
      }

      const keyboard = new InlineKeyboard()
        .url('💳 To\'lovga o\'tish', paymentLink)
        .row()
        .text('🔙 Asosiy menyu', 'main_menu');

      const providerNames = {
        click: 'Click',
        payme: 'Payme',
        uzcard: 'UzCard',
      };

      await ctx.editMessageText(
        `💳 <b>${providerNames[provider]} orqali to'lov</b>\n\n` +
        `💵 Summa: ${plan.price} so'm\n` +
        '♾️ Muddati: Umrbod!\n\n' +
        '✅ Bir marta to\'lov qiling va butun umr bepul foydalaning!\n\n' +
        'Quyidagi tugmani bosib to\'lovni amalga oshiring:',
        {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        },
      );
    } catch (error) {
      logger.error('Payment provider selection error:', error);
      await ctx.answerCallbackQuery('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  }

  private buildNameDetailKeyboard(slug: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('⭐ Sevimlilarga qo\'shish', `fav:toggle:${slug}`)
      .text('🔁 O\'xshash', `name:similar:${slug}`)
      .row()
      .text('🌍 Tarjima', `name:translate:${slug}`)
      .text('🔊 Talaffuz', `name:audio:${slug}`)
      .row()
      .text('📈 Trend', `name:trend:${slug}`)
      .text('🏠 Menyu', 'main_menu');
  }

  private async showNameDetail(ctx: BotContext, slug: string): Promise<void> {
    try {
      const record = this.insightsService.findRecordByName(slug);
      const targetName = record?.name ?? slug;
      const { meaning } = await this.insightsService.getRichNameMeaning(targetName);
      const formatted = this.insightsService.formatRichMeaning(
        targetName,
        meaning,
        record,
      );

      await this.safeEditOrReply(ctx, formatted, this.buildNameDetailKeyboard(record?.slug ?? slug));
      await ctx.answerCallbackQuery();
    } catch (error) {
      logger.error('Show name detail error:', error);
      await ctx.answerCallbackQuery('Ism tafsilotlarini ko\'rsatishda xatolik.');
    }
  }

  private async showSimilarNames(ctx: BotContext, slug: string): Promise<void> {
    const suggestions = this.insightsService.getSimilarNames(slug);
    if (!suggestions.length) {
      await ctx.answerCallbackQuery('O\'xshash ismlar topilmadi.');
      return;
    }

    const lines = suggestions.map((suggestion, index) => {
      const emoji = suggestion.gender === 'girl' ? '👧' : '👦';
      return `${index + 1}. ${emoji} <b>${suggestion.name}</b> — ${suggestion.meaning}`;
    });

    const message = `🔁 O'xshash ismlar:\n\n${lines.join('\n')}`;
    const keyboard = new InlineKeyboard();
    suggestions.forEach((suggestion) => {
      keyboard.row().text(`${suggestion.name}`, `name:detail:${suggestion.slug}`);
    });
    keyboard.row().text('🏠 Menyu', 'main_menu');

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async showTranslations(ctx: BotContext, slug: string): Promise<void> {
    const record = this.insightsService.findRecordByName(slug);
    if (!record) {
      await ctx.answerCallbackQuery('Tarjima topilmadi.');
      return;
    }

    const translations = this.insightsService.getTranslations(record.name);
    const lines = translations.map((item) => `• ${item.language}: <b>${item.value}</b>`);
    const message = `🌍 <b>${record.name}</b> tarjimalari:\n\n${lines.join('\n')}`;

    await this.safeEditOrReply(ctx, message, this.buildNameDetailKeyboard(record.slug));
    await ctx.answerCallbackQuery();
  }

  private async sendAudioPreview(ctx: BotContext, slug: string): Promise<void> {
    const record = this.insightsService.findRecordByName(slug);
    if (!record) {
      await ctx.answerCallbackQuery('Audio topilmadi.');
      return;
    }

    const audioUrl = this.insightsService.getAudioUrl(record.name);
    if (!audioUrl) {
      await ctx.answerCallbackQuery('Audio mavjud emas.');
      return;
    }

    await ctx.replyWithVoice(audioUrl, { caption: `🔊 ${record.name} talaffuzi` });
    await ctx.answerCallbackQuery();
  }

  private async showNameTrend(ctx: BotContext, slug: string): Promise<void> {
    const record = this.insightsService.findRecordByName(slug);
    if (!record) {
      await ctx.answerCallbackQuery('Trend ma\'lumoti topilmadi.');
      return;
    }

    const message =
      `📈 <b>${record.name}</b> trend ko\'rsatkichlari:\n\n` +
      `Oy bo'yicha indeks: ${record.trendIndex.monthly}\n` +
      `Yil bo'yicha indeks: ${record.trendIndex.yearly}\n` +
      `Hududlar: ${record.regions.join(', ')}\n\n` +
      'Trendni kuzatishda davom eting va ortda qolmang!';

    await this.safeEditOrReply(ctx, message, this.buildNameDetailKeyboard(record.slug));
    await ctx.answerCallbackQuery();
  }

  private async showFavoriteNames(ctx: BotContext, page = 1): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery('Foydalanuvchi aniqlanmadi.');
      return;
    }

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      await ctx.answerCallbackQuery('Avval /start buyrug\'ini yuboring.');
      return;
    }

    const list = await this.favoritesService.listFavorites(user.id, page);
    if (!list.totalItems) {
      const keyboard = new InlineKeyboard()
        .text('🌟 Ism qidirish', 'name_meaning')
        .row()
        .text('🏠 Menyu', 'main_menu');
      await this.safeEditOrReply(ctx, '⭐ Sevimli ismlar hali yo\'q. Istalgan ism ustida ⭐ tugmasini bosing.', keyboard);
      await ctx.answerCallbackQuery();
      return;
    }

    const lines = list.items.map((item, index) => {
      const emoji = item.gender === 'girl' ? '👧' : item.gender === 'boy' ? '👦' : '✨';
      return `${(page - 1) * list.items.length + index + 1}. ${emoji} <b>${item.name}</b> — ${item.origin ?? ''}`;
    });

    const message =
      `⭐ Sevimli ismlar ro\'yxati (Jami: ${list.totalItems})\n\n` +
      `${lines.join('\n')}\n\n` +
      'Ismlardan birini tanlab ma\'nosini oching yoki trendlarni kuzating.';

    const keyboard = new InlineKeyboard();
    list.items.forEach((item) => {
      if (item.slug) {
        keyboard.row().text(item.name, `name:detail:${item.slug}`);
      }
    });

    if (list.totalPages > 1) {
      const prevPage = page > 1 ? page - 1 : list.totalPages;
      const nextPage = page < list.totalPages ? page + 1 : 1;
      keyboard.row()
        .text('⬅️', `fav:list:${prevPage}`)
        .text(`${page}/${list.totalPages}`, 'main_menu')
        .text('➡️', `fav:list:${nextPage}`);
    }

    keyboard.row().text('🏠 Menyu', 'main_menu');
    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async toggleFavorite(ctx: BotContext, slug: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery('Foydalanuvchi aniqlanmadi.');
      return;
    }

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      await ctx.answerCallbackQuery('Avval /start buyrug\'ini yuboring.');
      return;
    }

    try {
      const result = await this.favoritesService.toggleFavorite(user.id, slug);
      await ctx.answerCallbackQuery(
        result === 'added' ? '⭐ Sevimlilarga qo\'shildi.' : '🗑 Sevimlilardan olib tashlandi.',
        { show_alert: false } as any,
      );
    } catch (error) {
      logger.error('Toggle favorite error:', error);
      await ctx.answerCallbackQuery('Sevimlilarni yangilashda xatolik.');
    }
  }

  private async showCategoryFilterMenu(ctx: BotContext): Promise<void> {
    const combos = this.insightsService.getCategoryCombos();
    const keyboard = new InlineKeyboard();
    combos.forEach((combo, index) => {
      keyboard.text(combo.label, `filter:combo:${combo.key}:all`);
      if (index % 2 === 1) {
        keyboard.row();
      }
    });
    keyboard.row().text('🏠 Menyu', 'main_menu');

    const descriptions = Object.entries(this.insightsService.getCategoryDescriptors())
      .map(([_, descriptor]) => `• <b>${descriptor.label}</b> — ${descriptor.description}`)
      .join('\n');

    const message =
      '🧭 Kategoriya filterlari\n\n' +
      'Ramziy, rahbariy, zamonaviy va boshqa yo\'nalishlarda tanlang.\n\n' +
      `${descriptions}\n\n` +
      'Quyidagi kombinatsiyalardan birini bosing:';

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async showCategorySuggestions(
    ctx: BotContext,
    comboKey: string,
    gender: TrendGender,
  ): Promise<void> {
    const suggestions = this.insightsService.getNamesForCategory(comboKey, gender);
    if (!suggestions.length) {
      await ctx.answerCallbackQuery('Bu kombinatsiyada ism topilmadi.');
      return;
    }

    const messageLines = suggestions.slice(0, 6).map((suggestion, index) => {
      const emoji = suggestion.gender === 'girl' ? '👧' : '👦';
      return `${index + 1}. ${emoji} <b>${suggestion.name}</b> — ${suggestion.meaning}`;
    });

    const message =
      `🧭 Tanlangan kombinatsiya: <b>${comboKey.replace('_', ' + ')}</b>\n` +
      `Filtr: ${gender === 'all' ? 'Hammasi' : gender}\n\n` +
      `${messageLines.join('\n')}\n\n` +
      'Ismni tanlab, ma\'nosi va trendini ko\'ring.';

    const keyboard = new InlineKeyboard()
      .text('👧 Qizlar', `filter:combo:${comboKey}:girl`)
      .text('👦 O\'g\'il bolalar', `filter:combo:${comboKey}:boy`)
      .row()
      .text('♻️ Hammasi', `filter:combo:${comboKey}:all`)
      .text('🏠 Menyu', 'main_menu');

    suggestions.slice(0, 6).forEach((suggestion) => {
      keyboard.row().text(suggestion.name, `name:detail:${suggestion.slug}`);
    });

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async showTrendMenu(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('📈 Oy bo\'yicha', 'trend:overview:monthly:all')
      .text('📊 Yil bo\'yicha', 'trend:overview:yearly:all')
      .row()
      .text('👧 Qizlar', 'trend:overview:monthly:girl')
      .text('👦 O\'g\'illar', 'trend:overview:monthly:boy')
      .row()
      .text('🏠 Menyu', 'main_menu');

    const message =
      '📈 Trendlar markazi\n\n' +
      'Har oy va yil kesimida eng mashhur ismlar.\n' +
      'Jins bo\'yicha ham ko\'rishingiz mumkin.\n\n' +
      'Kerakli bo\'limni tanlang:';

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async showTrendOverview(
    ctx: BotContext,
    period: TrendPeriod,
    gender: TrendGender,
  ): Promise<void> {
    const insights = this.insightsService.getTrending(period, gender).slice(0, 6);
    if (!insights.length) {
      await ctx.answerCallbackQuery('Trend ma\'lumotlari topilmadi.');
      return;
    }

    const lines = insights.map((item, index) => {
      const emoji = item.gender === 'girl' ? '👧' : '👦';
      const direction = item.movement === 'up' ? '⬆️' : item.movement === 'down' ? '⬇️' : '⏸';
      return `${index + 1}. ${emoji} <b>${item.name}</b> — ${direction} ${item.score} • ${item.region}`;
    });

    const message =
      `📈 Trendlar (${period === 'monthly' ? 'oylik' : 'yillik'}, ${gender})\n\n` +
      `${lines.join('\n')}\n\n` +
      'Ismni tanlab, batafsil ma\'lumot oling.';

    const keyboard = new InlineKeyboard();
    insights.forEach((item) => {
      keyboard.row().text(item.name, `name:detail:${item.name.toLowerCase()}`);
    });
    keyboard.row().text('🏠 Menyu', 'main_menu');

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async showCommunityMenu(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('⭐ Sevimlilar', 'fav:list:1')
      .text('📊 So\'rovnoma', 'community:poll')
      .row()
      .text('🔗 Ulashish', 'community:share')
      .text('🏠 Menyu', 'main_menu');

    const message =
      '🌍 Jamiyat bo\'limi\n\n' +
      '• Sevimli ismlar ro\'yxatini ko\'ring\n' +
      '• Trend so\'rovnomalarida qatnashing\n' +
      '• Inline qidiruv orqali do\'stlar bilan ulashing';

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async startPersonalizationFlow(ctx: BotContext): Promise<void> {
    ctx.session.flow = {
      name: 'personalization',
      step: 1,
      payload: { focusValues: [] },
    };

    const keyboard = new InlineKeyboard()
      .text('👧 Qiz bolaga', 'personal:gender:girl')
      .text('👦 O\'g\'il bolaga', 'personal:gender:boy')
      .row()
      .text('🤍 Aniqlanmagan', 'personal:gender:all')
      .row()
      .text('🏠 Menyu', 'main_menu');

    const message =
      '🎯 Shaxsiy tavsiya generatori\n\n' +
      'Avvalo, qaysi jins uchun ism tanlashni belgilang:';

    await this.safeEditOrReply(ctx, message, keyboard);
    await ctx.answerCallbackQuery();
  }

  private async handlePersonalizationMessageInput(ctx: BotContext, message: string): Promise<void> {
    const flow = ctx.session.flow;
    if (!flow || flow.name !== 'personalization') {
      return;
    }

    switch (flow.step) {
      case 2: {
        if (message.toLowerCase() !== 'skip') {
          const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(message);
          if (!isValidDate) {
            await ctx.reply('❗ Sana formati noto\'g\'ri. Iltimos, YYYY-MM-DD shaklida kiriting yoki skip deb yozing.');
            return;
          }
          flow.payload.birthDate = new Date(message);
        }
        flow.step = 3;
        await ctx.reply(
          '👪 Familiyangizni kiriting. Masalan: Rasulov.\nAgar bu bosqichni o\'tkazib yubormoqchi bo\'lsangiz skip deb yozing.',
        );
        break;
      }
      case 3: {
        if (message.toLowerCase() !== 'skip') {
          flow.payload.familyName = message;
        }
        flow.step = 4;
        await ctx.reply(
          '👨‍👩‍👦 Ota-ona ismlarini vergul bilan yozing. Masalan: Nodira, Farhod.\nAgar o\'tkazsangiz skip deb yozing.',
        );
        break;
      }
      case 4: {
        if (message.toLowerCase() !== 'skip') {
          flow.payload.parentNames = message
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        }
        flow.step = 5;
        await this.promptFocusSelection(ctx);
        break;
      }
      default:
        break;
    }
  }

  private async promptFocusSelection(ctx: BotContext): Promise<void> {
    const flow = ctx.session.flow;
    if (!flow || flow.name !== 'personalization') {
      return;
    }

    const selected: string[] = flow.payload.focusValues || [];
    const keyboard = new InlineKeyboard();
    PERSONAL_FOCUS_TAGS.forEach((item, index) => {
      const prefix = selected.includes(item.tag) ? '✅' : '▫️';
      keyboard.text(`${prefix} ${item.label}`, `personal:focus:${item.tag}`);
      if (index % 2 === 1) {
        keyboard.row();
      }
    });
    keyboard.row().text('✅ Tayyor', 'personal:focus:done');
    keyboard.text('🔄 Qayta boshlash', 'personal:focus:reset');
    keyboard.row().text('🏠 Menyu', 'main_menu');

    const selectedLine = selected.length
      ? `Tanlangan qadriyatlar: ${selected.map((tag) => `#${tag}`).join(' ')}`
      : 'Hozircha tanlov belgilanmagan.';

    const message =
      '✨ Qaysi qadriyatlar siz uchun muhim? Bir nechtasini tanlang:\n\n' +
      selectedLine +
      '\n\n✅ Tugmani bosib yakunlang.';

    await this.safeEditOrReply(ctx, message, keyboard);
  }

  private async finalizePersonalization(ctx: BotContext): Promise<void> {
    const flow = ctx.session.flow;
    if (!flow || flow.name !== 'personalization') {
      await ctx.answerCallbackQuery();
      return;
    }

    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery('Foydalanuvchi aniqlanmadi.');
      return;
    }

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      await ctx.answerCallbackQuery('Avval /start buyrug\'ini yuboring.');
      return;
    }

    const profile = {
      birthDate: flow.payload.birthDate as Date | undefined,
      targetGender: (flow.payload.targetGender as TrendGender) ?? 'all',
      familyName: flow.payload.familyName as string | undefined,
      parentNames: flow.payload.parentNames as string[] | undefined,
      focusValues: flow.payload.focusValues as string[] | undefined,
    };

    const persona = this.insightsService.buildPersonalizedRecommendations(
      profile,
      profile.focusValues ?? [],
    );

    const targetGender: TargetGender =
      profile.targetGender === 'boy' || profile.targetGender === 'girl'
        ? profile.targetGender
        : 'unknown';

    await this.personaService.upsertProfile(user.id, {
      expectedBirthDate: profile.birthDate,
      targetGender,
      familyName: profile.familyName,
      parentNames: profile.parentNames,
      focusValues: profile.focusValues,
      personaType: persona.personaCode,
    });

    const suggestionsLines = persona.suggestions.map((suggestion, index) => {
      const emoji = suggestion.gender === 'girl' ? '👧' : '👦';
      return `${index + 1}. ${emoji} <b>${suggestion.name}</b> — ${suggestion.meaning}`;
    });

    const message =
      `🎯 Shaxsiy profil: <b>${persona.personaLabel}</b>\n` +
      `${persona.summary}\n\n` +
      `${suggestionsLines.join('\n')}\n\n` +
      'Ismlardan birini tanlab, ma\'nosini, trendini va tarjimasini ko\'rib chiqing.';

    const keyboard = new InlineKeyboard();
    persona.suggestions.forEach((suggestion) => {
      keyboard.row().text(suggestion.name, `name:detail:${suggestion.slug}`);
    });
    keyboard.row().text('🏠 Menyu', 'main_menu');

    await this.safeEditOrReply(ctx, message, keyboard);
    ctx.session.flow = undefined;
    await ctx.answerCallbackQuery();
  }

  private async startQuiz(ctx: BotContext): Promise<void> {
    ctx.session.flow = {
      name: 'quiz',
      step: 0,
      payload: {},
    };
    ctx.session.quizAnswers = {};
    ctx.session.quizTags = [];
    await this.sendQuizQuestion(ctx, 0);
  }

  private async processQuizAnswer(
    ctx: BotContext,
    questionId: string,
    value: string,
  ): Promise<void> {
    const flow = ctx.session.flow;
    if (!flow || flow.name !== 'quiz') {
      await ctx.answerCallbackQuery();
      return;
    }

    const question = this.quizFlow.find((item) => item.id === questionId);
    if (!question) {
      await ctx.answerCallbackQuery();
      return;
    }

    const answer = question.options.find((option) => option.value === value);
    if (!answer) {
      await ctx.answerCallbackQuery();
      return;
    }

    ctx.session.quizAnswers = {
      ...(ctx.session.quizAnswers || {}),
      [questionId]: value,
    };

    ctx.session.quizTags = [
      ...(ctx.session.quizTags || []),
      ...answer.tags,
    ];

    const nextStep = flow.step + 1;
    if (nextStep >= this.quizFlow.length) {
      await this.finishQuiz(ctx);
      return;
    }

    flow.step = nextStep;
    await this.sendQuizQuestion(ctx, nextStep);
    await ctx.answerCallbackQuery('Tanlov qabul qilindi.');
  }

  private async sendQuizQuestion(ctx: BotContext, index: number): Promise<void> {
    const question = this.quizFlow[index];
    if (!question) {
      return;
    }

    const keyboard = new InlineKeyboard();
    question.options.forEach((option) => {
      keyboard.row().text(option.label, `quiz:answer:${question.id}:${option.value}`);
    });
    keyboard.row().text('🏠 Menyu', 'main_menu');

    await this.safeEditOrReply(
      ctx,
      `🧪 Savol ${index + 1}/${this.quizFlow.length}\n\n${question.text}`,
      keyboard,
    );
  }

  private async finishQuiz(ctx: BotContext): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery('Foydalanuvchi aniqlanmadi.');
      return;
    }

    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      await ctx.answerCallbackQuery('Avval /start buyrug\'ini yuboring.');
      return;
    }

    const profile = await this.personaService.getProfile(user.id);
    const targetGender: TrendGender =
      profile?.targetGender === 'boy' || profile?.targetGender === 'girl'
        ? profile.targetGender
        : 'all';

    const focusValues = profile?.focusValues ?? [];
    const tags = [...(ctx.session.quizTags || []), ...focusValues];

    const recommendations = this.insightsService.buildPersonalizedRecommendations(
      {
        targetGender,
        focusValues,
      },
      tags,
    );

    await this.personaService.upsertProfile(user.id, {
      targetGender: targetGender === 'all' ? 'unknown' : (targetGender as TargetGender),
      focusValues: recommendations.suggestions.map((item) => item.focusValues).flat(),
      personaType: recommendations.personaCode,
      quizAnswers: ctx.session.quizAnswers,
    });

    const messageLines = recommendations.suggestions.map((item, index) => {
      const emoji = item.gender === 'girl' ? '👧' : '👦';
      return `${index + 1}. ${emoji} <b>${item.name}</b> — ${item.meaning}`;
    });

    const message =
      `✅ Mini-test yakunlandi!\n` +
      `Profil: <b>${recommendations.personaLabel}</b>\n${recommendations.summary}\n\n` +
      `${messageLines.join('\n')}`;

    const keyboard = new InlineKeyboard();
    recommendations.suggestions.forEach((item) => {
      keyboard.row().text(item.name, `name:detail:${item.slug}`);
    });
    keyboard.row().text('🏠 Menyu', 'main_menu');

    await this.safeEditOrReply(ctx, message, keyboard);

    ctx.session.flow = undefined;
    ctx.session.quizAnswers = undefined;
    ctx.session.quizTags = undefined;

    await ctx.answerCallbackQuery('Tavsiyalar tayyor!');
  }

  private async safeEditOrReply(
    ctx: BotContext,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    } catch {
      await ctx.reply(text, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    }
  }

  // Keep bot getter for external access
  public getBot(): Bot<BotContext> {
    return this.bot;
  }
}
