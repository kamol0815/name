import { Injectable } from '@nestjs/common';
import { NameMeaningService } from './name-meaning.service';

export type NameGender = 'boy' | 'girl' | 'unisex';
export type TrendPeriod = 'monthly' | 'yearly';
export type TrendGender = 'boy' | 'girl' | 'all';

export interface NameRecord {
  slug: string;
  name: string;
  gender: NameGender;
  origin: string;
  meaning: string;
  categories: string[];
  focusValues: string[];
  storytelling: string;
  translations: { language: string; value: string }[];
  regions: string[];
  trendIndex: { monthly: number; yearly: number };
  audioUrl?: string;
  related: string[];
}

export interface PersonalizedProfile {
  birthDate?: Date;
  targetGender: TrendGender;
  familyName?: string;
  parentNames?: string[];
  focusValues?: string[];
  personaType?: string;
}

export interface NameSuggestion {
  name: string;
  gender: NameGender;
  slug: string;
  origin: string;
  meaning: string;
  focusValues: string[];
  trendIndex: number;
}

export interface TrendInsight {
  name: string;
  movement: 'up' | 'down' | 'steady';
  score: number;
  region: string;
  gender: NameGender;
}

export interface InlineNameCard {
  id: string;
  title: string;
  description: string;
  message: string;
  keyboardPayload: {
    slug: string;
    gender: NameGender;
  };
}

export interface QuizOption {
  label: string;
  value: string;
  tags: string[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

const CATEGORY_DESCRIPTORS: Record<string, { label: string; description: string }> = {
  symbolic: { label: 'Ramziy ruh', description: "Nur, ziyoli va qalbga yaqin ma'nolar." },
  leadership: { label: 'Rahbariy ohang', description: 'Jasoratli va yetakchi xarakterlar uchun.' },
  spiritual: { label: 'Ma\'naviy olam', description: 'Diniy va ruhiy mazmunga ega ismlar.' },
  heritage: { label: 'An\'anaviy', description: "Ota-bobolar merosidan kelgan klassik ismlar." },
  modern: { label: 'Zamonaviy', description: "Bugungi trend va yangi ma'no qo'shilgan ismlar." },
  nature: { label: 'Tabiat nafasi', description: 'Tabiat va unsurlardan ilhomlangan ismlar.' },
};

const CATEGORY_COMBOS: Array<{ key: string; left: string; right: string }> = [
  { key: 'symbolic_leadership', left: 'Ramziy', right: 'Rahbariy' },
  { key: 'spiritual_heritage', left: 'Ma\'naviy', right: 'An\'anaviy' },
  { key: 'modern_symbolic', left: 'Zamonaviy', right: 'Ramziy' },
  { key: 'nature_spiritual', left: 'Tabiat', right: 'Ma\'naviy' },
];

const NAME_LIBRARY: NameRecord[] = [
  {
    slug: 'zuhra',
    name: 'Zuhra',
    gender: 'girl',
    origin: "Arabcha",
    meaning: "Tong yulduzi, yorug'lik taratuvchi nur.",
    categories: ['symbolic', 'spiritual'],
    focusValues: ['ramziy', 'nur', 'ilhom'],
    storytelling: "Zuhra sahar tongida dunyoga kelgan qizaloqlarga yorug'lik tilash uchun qo'yiladi.",
    translations: [
      { language: 'Ruscha', value: 'Зухра' },
      { language: 'Turkcha', value: 'Zühre' },
      { language: 'Inglizcha', value: 'Morning Star' },
    ],
    regions: ['Toshkent', 'Qashqadaryo'],
    trendIndex: { monthly: 87, yearly: 91 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2023/03/16/audio_c655df5b1a.mp3?filename=soft-bell-146622.mp3',
    related: ['Ziyo', 'Zuhro', 'Zulayho'],
  },
  {
    slug: 'amir',
    name: 'Amir',
    gender: 'boy',
    origin: 'Arabcha',
    meaning: "Yetakchi, qo'mondon, rahbar.",
    categories: ['leadership', 'heritage'],
    focusValues: ['rahbar', 'jasorat'],
    storytelling: "Amir ismi o'g'il bolalarga murod-maqsadini ortda qoldirmasligi uchun tanlanadi.",
    translations: [
      { language: 'Ruscha', value: 'Амир' },
      { language: 'Turkcha', value: 'Emir' },
      { language: 'Inglizcha', value: 'Amir' },
    ],
    regions: ["Farg'ona", 'Toshkent'],
    trendIndex: { monthly: 93, yearly: 88 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_3febef0c3d.mp3?filename=soft-notification-136512.mp3',
    related: ['Amirbek', 'Amirxon', 'Emir'],
  },
  {
    slug: 'shirin',
    name: 'Shirin',
    gender: 'girl',
    origin: 'Forscha',
    meaning: "Shirin so'zli, yoqimli muomala qiluvchi.",
    categories: ['symbolic', 'heritage'],
    focusValues: ['ramziy', 'mehribonlik'],
    storytelling: "Shirin ismi Mehr bilan bog'liq bo'lib, iliqlikni ifodalaydi.",
    translations: [
      { language: 'Ruscha', value: 'Ширин' },
      { language: 'Turkcha', value: 'Şirin' },
      { language: 'Inglizcha', value: 'Sweet' },
    ],
    regions: ['Buxoro', 'Samarqand'],
    trendIndex: { monthly: 81, yearly: 79 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/13/audio_81808b4a31.mp3?filename=soft-ambient-8282.mp3',
    related: ['Shahnoza', 'Gulshirin', 'Mehriniso'],
  },
  {
    slug: 'javlon',
    name: 'Javlon',
    gender: 'boy',
    origin: 'Turkiy',
    meaning: "G'ayrat va jasorat timsoli.",
    categories: ['leadership', 'modern'],
    focusValues: ['rahbar', 'jasorat', 'zamonaviy'],
    storytelling: 'Javlon ismi harakat va dadillikni ifodalaydi.',
    translations: [
      { language: 'Ruscha', value: 'Джавлон' },
      { language: 'Turkcha', value: 'Cavlon' },
      { language: 'Inglizcha', value: 'Valor' },
    ],
    regions: ['Namangan', 'Andijon'],
    trendIndex: { monthly: 76, yearly: 84 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/11/16/audio_2bbd603cd8.mp3?filename=warm-guitar-logo-12414.mp3',
    related: ['Javohir', 'Jasur', 'Javod'],
  },
  {
    slug: 'muslima',
    name: 'Muslima',
    gender: 'girl',
    origin: 'Arabcha',
    meaning: 'Islom diniga sodiq, muslim ayol.',
    categories: ['spiritual', 'heritage'],
    focusValues: ["ma'naviy", 'ramziy'],
    storytelling: "Muslima ismi sokinlik va sodiqlikni o'zida mujassam etadi.",
    translations: [
      { language: 'Ruscha', value: 'Муслима' },
      { language: 'Turkcha', value: 'Müslime' },
      { language: 'Inglizcha', value: 'Muslima' },
    ],
    regions: ['Andijon', 'Namangan'],
    trendIndex: { monthly: 89, yearly: 94 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_17b9987dd8.mp3?filename=soft-logo-6124.mp3',
    related: ['Mushtariy', 'Mubina', 'Muhsina'],
  },
  {
    slug: 'bilol',
    name: 'Bilol',
    gender: 'boy',
    origin: 'Arabcha',
    meaning: 'Halovat beruvchi, qalbni taskin etuvchi.',
    categories: ['spiritual', 'symbolic'],
    focusValues: ["ma'naviy", 'ramziy', 'ilhom'],
    storytelling: "Bilol ismi tarixda sahobalar bilan bog'liq bo'lib, ezgulikni bildiradi.",
    translations: [
      { language: 'Ruscha', value: 'Билал' },
      { language: 'Turkcha', value: 'Bilal' },
      { language: 'Inglizcha', value: 'Bilal' },
    ],
    regions: ['Surxondaryo', 'Toshkent'],
    trendIndex: { monthly: 97, yearly: 90 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/24/audio_8d3b8b1dcb.mp3?filename=clean-notification-124058.mp3',
    related: ['Biloliddin', 'Bilola', 'Nilufar'],
  },
  {
    slug: 'laylo',
    name: 'Laylo',
    gender: 'girl',
    origin: 'Forscha',
    meaning: 'Tungi huzur, romantik ohang.',
    categories: ['modern', 'symbolic'],
    focusValues: ['ramziy', 'muloyim'],
    storytelling: "Laylo ismi she'riyat va muhabbat bilan bog'liq.",
    translations: [
      { language: 'Ruscha', value: 'Лайло' },
      { language: 'Turkcha', value: 'Leyla' },
      { language: 'Inglizcha', value: 'Layla' },
    ],
    regions: ['Toshkent', 'Samarqand'],
    trendIndex: { monthly: 92, yearly: 96 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c1889958cf.mp3?filename=soft-intro-135464.mp3',
    related: ['Layloyim', 'Laziza', 'Royhon'],
  },
  {
    slug: 'islom',
    name: 'Islom',
    gender: 'boy',
    origin: 'Arabcha',
    meaning: 'Tinchlik, totuvlik va islom dini nomi.',
    categories: ['spiritual', 'heritage'],
    focusValues: ["ma'naviy", 'ramziy', 'jahongir'],
    storytelling: "Islom ismi e'tiqod va birlik timsoli sifatida tanlanadi.",
    translations: [
      { language: 'Ruscha', value: 'Ислам' },
      { language: 'Turkcha', value: 'İslam' },
      { language: 'Inglizcha', value: 'Islam' },
    ],
    regions: ["Qoraqalpog'iston", 'Toshkent'],
    trendIndex: { monthly: 84, yearly: 90 },
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/09/20/audio_55a0189da2.mp3?filename=gentle-sound-121110.mp3',
    related: ['Imron', 'Ilyos', 'Imod'],
  },
];

const TREND_MOVEMENTS: TrendInsight[] = [
  { name: 'Amir', movement: 'up', score: 93, region: "Farg'ona", gender: 'boy' },
  { name: 'Laylo', movement: 'up', score: 96, region: 'Toshkent', gender: 'girl' },
  { name: 'Bilol', movement: 'steady', score: 90, region: 'Surxondaryo', gender: 'boy' },
  { name: 'Zuhra', movement: 'up', score: 91, region: 'Qashqadaryo', gender: 'girl' },
  { name: 'Muslima', movement: 'steady', score: 94, region: 'Namangan', gender: 'girl' },
  { name: 'Javlon', movement: 'down', score: 84, region: 'Andijon', gender: 'boy' },
];

const QUIZ_FLOW: QuizQuestion[] = [
  {
    id: 'temper',
    text: "Farzandingiz xarakteri qanday bo'lishini istaysiz?",
    options: [
      { label: 'Sokin va muloyim', value: 'calm', tags: ['ramziy', 'muloyim'] },
      { label: 'Yetakchi va faol', value: 'leader', tags: ['rahbar'] },
      { label: 'Ijodkor va ilhomli', value: 'creator', tags: ['ilhom'] },
      { label: "Ma'naviyatli va yuksak", value: 'spiritual', tags: ["ma'naviy"] },
    ],
  },
  {
    id: 'legacy',
    text: "Qaysi qatlamga yaqinmisiz?",
    options: [
      { label: "An'anaviy meros", value: 'heritage', tags: ['heritage'] },
      { label: 'Zamonaviy ruh', value: 'modern', tags: ['zamonaviy'] },
      { label: "Tabiat va uyg'unlik", value: 'nature', tags: ['tabiat'] },
    ],
  },
  {
    id: 'sound',
    text: "Ism ohangi qanday bo'lishi kerak?",
    options: [
      { label: 'Qisqa va chaqqon', value: 'short', tags: ['rahbar'] },
      { label: 'Uzun va lirika', value: 'long', tags: ['ramziy'] },
      { label: 'Quvnoq va ritmik', value: 'rhythm', tags: ['zamonaviy'] },
    ],
  },
  {
    id: 'blend',
    text: "Familiyangiz bilan uyg'unlik?",
    options: [
      { label: 'Bosh harf mosligi muhim', value: 'initial', tags: ['moslik'] },
      { label: 'Ohangdoshlik muhim', value: 'rhythm', tags: ['ohang'] },
      { label: 'Qadriyatni ifodalasin', value: 'value', tags: ["ma'naviy"] },
    ],
  },
  {
    id: 'bonus',
    text: 'Ismga yana bir istak:',
    options: [
      { label: "Trendda bo'lsin", value: 'trendy', tags: ['zamonaviy', 'trend'] },
      { label: 'Oson talaffuz qilinsin', value: 'easy', tags: ['muloyim'] },
      { label: "Unutilmas bo'lsin", value: 'unique', tags: ['rahbar', 'ramziy'] },
    ],
  },
];

const PERSONA_TEMPLATES: Record<string, { label: string; tags: string[]; blurb: string }> = {
  radiant: {
    label: 'Nurafshon',
    tags: ['ramziy', 'ilhom', 'muloyim'],
    blurb: "Yorug'lik taratuvchi va qalbni iliqlantiruvchi ismlar to'plami.",
  },
  pioneer: {
    label: 'Yetakchi',
    tags: ['rahbar', 'zamonaviy'],
    blurb: 'Jasorat va modern ruhni ifodalovchi kombinatsiyalar.',
  },
  heritage: {
    label: 'Merosbon',
    tags: ["ma'naviy", 'heritage'],
    blurb: "An'anaviy va ruhiy qadriyatlarni saqlab qoluvchi ismlar.",
  },
  harmony: {
    label: "Uyg'un",
    tags: ['tabiat', 'muloyim', 'ohang'],
    blurb: "Tabiat va ohang uyg'unligini sevuvchilar uchun tavsiyalar.",
  },
};

const COMMUNITY_POLLS = [
  {
    question: '2024-yilda qaysi ism trendni zabt etadi?',
    options: ['Laylo', 'Amir', 'Muslima', 'Bilol'],
  },
  {
    question: "Qaysi yo'nalish sizga ko'proq yoqadi?",
    options: ['Ramziy', 'Rahbariy', "Ma'naviy", 'Zamonaviy'],
  },
];

@Injectable()
export class NameInsightsService {
  constructor(private readonly meaningService: NameMeaningService) {}

  getCategoryDescriptors(): typeof CATEGORY_DESCRIPTORS {
    return CATEGORY_DESCRIPTORS;
  }

  getCategoryCombos(): Array<{ key: string; label: string }> {
    return CATEGORY_COMBOS.map((combo) => ({
      key: combo.key,
      label: `${combo.left} ~ ${combo.right}`,
    }));
  }

  findRecordByName(name: string): NameRecord | undefined {
    const normalized = name.trim().toLowerCase();
    return NAME_LIBRARY.find((record) => record.slug === normalized || record.name.toLowerCase() === normalized);
  }

  search(query: string, limit = 12): NameRecord[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return NAME_LIBRARY.slice(0, limit);
    }
    return NAME_LIBRARY.filter((record) => {
      return (
        record.name.toLowerCase().includes(normalized) ||
        record.origin.toLowerCase().includes(normalized) ||
        record.focusValues.some((v) => v.includes(normalized)) ||
        record.categories.some((c) => c.includes(normalized))
      );
    }).slice(0, limit);
  }

  async getRichNameMeaning(name: string): Promise<{ record?: NameRecord; meaning: string }> {
    const record = this.findRecordByName(name);
    if (record) {
      return { record, meaning: record.meaning };
    }
    const meaning = await this.meaningService.getNameMeaning(name);
    return { meaning: meaning.meaning || '', record: undefined };
  }

  formatRichMeaning(name: string, meaning: string, record?: NameRecord): string {
    const headline = `🌟 <b>${name}</b> ismi haqida`;
    const meaningBlock = meaning ? `\n📘 <b>Ma'nosi:</b> ${meaning}\n` : "\n📘 Ma'lumot hozircha topilmadi.\n";

    if (!record) {
      return `${headline}\n${meaningBlock}\n🔁 Yana boshqa ismni sinab ko'ring.`;
    }

    const origin = `🌍 <b>Kelib chiqishi:</b> ${record.origin}`;
    const values = record.focusValues.length ? `✨ <b>Ohangi:</b> ${record.focusValues.map((v) => `#${v}`).join('  ')}` : '';
    const story = record.storytelling ? `\n🧩 <i>${record.storytelling}</i>\n` : '';
    const related = record.related.length ? `\n🔎 O'xshash ismlar: ${record.related.join(', ')}` : '';
    const trend = `📈 Trend indeks: oy ⇒ ${record.trendIndex.monthly} / yil ⇒ ${record.trendIndex.yearly}`;
    return `${headline}\n${meaningBlock}${origin}\n${values}${story}${trend}${related}`;
  }

  getSimilarNames(name: string, limit = 4): NameSuggestion[] {
    const record = this.findRecordByName(name);
    if (!record) {
      return [];
    }
    const matches = NAME_LIBRARY.filter((candidate) => {
      if (candidate.slug === record.slug) {
        return false;
      }
      return candidate.focusValues.some((value) => record.focusValues.includes(value));
    });
    return matches.slice(0, limit).map((candidate) => ({
      name: candidate.name,
      gender: candidate.gender,
      slug: candidate.slug,
      origin: candidate.origin,
      meaning: candidate.meaning,
      focusValues: candidate.focusValues,
      trendIndex: candidate.trendIndex.monthly,
    }));
  }

  getTranslations(name: string): { language: string; value: string }[] {
    const record = this.findRecordByName(name);
    return record?.translations || [];
  }

  getAudioUrl(name: string): string | undefined {
    const record = this.findRecordByName(name);
    return record?.audioUrl;
  }

  getTrending(period: TrendPeriod, gender: TrendGender): TrendInsight[] {
    const filtered = TREND_MOVEMENTS.filter((item) => {
      if (gender === 'all') {
        return true;
      }
      return item.gender === gender;
    });
    return filtered
      .map((item) => ({
        ...item,
        score: period === 'monthly'
          ? this.findRecordByName(item.name)?.trendIndex.monthly ?? item.score
          : this.findRecordByName(item.name)?.trendIndex.yearly ?? item.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  getNamesForCategory(key: string, gender: TrendGender): NameSuggestion[] {
    const categories = key.split('_');
    const filtered = NAME_LIBRARY.filter((record) => {
      const matchesGender = gender === 'all' ? true : record.gender === gender;
      const matchesCategory = categories.every((category) => record.categories.includes(category));
      return matchesGender && matchesCategory;
    });
    return filtered.map((record) => ({
      name: record.name,
      gender: record.gender,
      slug: record.slug,
      origin: record.origin,
      meaning: record.meaning,
      focusValues: record.focusValues,
      trendIndex: record.trendIndex.monthly,
    }));
  }

  generateInlineCards(query: string, limit = 12): InlineNameCard[] {
    return this.search(query, limit).map((record) => ({
      id: record.slug,
      title: record.name,
      description: `${record.gender === 'girl' ? '👧' : '👦'} ${record.origin} • trend ${record.trendIndex.monthly}%`,
      message: this.formatRichMeaning(record.name, record.meaning, record),
      keyboardPayload: {
        slug: record.slug,
        gender: record.gender,
      },
    }));
  }

  getQuizFlow(): QuizQuestion[] {
    return QUIZ_FLOW;
  }

  derivePersonaFromTags(tags: string[]): { code: string; template: typeof PERSONA_TEMPLATES[keyof typeof PERSONA_TEMPLATES] } {
    const scoreMap = new Map<string, number>();
    tags.forEach((tag) => {
      Object.entries(PERSONA_TEMPLATES).forEach(([code, template]) => {
        if (template.tags.includes(tag)) {
          scoreMap.set(code, (scoreMap.get(code) ?? 0) + 1);
        }
      });
    });
    const [bestCode] = Array.from(scoreMap.entries()).sort((a, b) => b[1] - a[1])[0] ?? ['radiant', 0];
    return { code: bestCode, template: PERSONA_TEMPLATES[bestCode] };
  }

  buildPersonalizedRecommendations(
    profile: PersonalizedProfile,
    answersTags: string[],
  ): { personaCode: string; personaLabel: string; summary: string; suggestions: NameSuggestion[] } {
    const tags = new Set<string>();
    if (profile.focusValues) {
      profile.focusValues.forEach((tag) => tags.add(tag));
    }
    answersTags.forEach((tag) => tags.add(tag));
    const persona = this.derivePersonaFromTags(Array.from(tags));

    const genderFilter = profile.targetGender === 'all' ? undefined : profile.targetGender;
    const suggestions = NAME_LIBRARY.filter((record) => {
      const matchesGender = !genderFilter || record.gender === genderFilter;
      const matchesPersona = persona.template.tags.some((tag) => record.focusValues.includes(tag));
      return matchesGender && matchesPersona;
    })
      .slice(0, 5)
      .map((record) => ({
        name: record.name,
        gender: record.gender,
        slug: record.slug,
        origin: record.origin,
        meaning: record.meaning,
        focusValues: record.focusValues,
        trendIndex: record.trendIndex.monthly,
      }));

    return {
      personaCode: persona.code,
      personaLabel: persona.template.label,
      summary: persona.template.blurb,
      suggestions,
    };
  }

  getCommunityPoll(): { question: string; options: string[] } {
    const index = Math.floor(Math.random() * COMMUNITY_POLLS.length);
    return COMMUNITY_POLLS[index];
  }
}
