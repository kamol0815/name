import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavoriteNameEntity } from '../../../shared/database/entities/user-favorite-name.entity';
import { NameInsightsService, NameSuggestion } from './name-insights.service';

export interface FavoriteList {
  items: Array<{
    name: string;
    gender: string;
    meaning?: string;
    origin?: string;
    slug?: string;
  }>;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

@Injectable()
export class UserFavoritesService {
  constructor(
    @InjectRepository(UserFavoriteNameEntity)
    private readonly favoritesRepository: Repository<UserFavoriteNameEntity>,
    @Inject(forwardRef(() => NameInsightsService))
    private readonly insightsService: NameInsightsService,
  ) { }

  async toggleFavorite(userId: string, slug: string): Promise<'added' | 'removed'> {
    const record = this.insightsService.findRecordByName(slug);
    if (!record) {
      throw new Error('Ism topilmadi');
    }

    const existing = await this.favoritesRepository.findOne({
      where: { userId, slug: record.slug },
    });

    if (existing) {
      await this.favoritesRepository.remove(existing);
      return 'removed';
    }

    const suggestion: NameSuggestion = {
      name: record.name,
      gender: record.gender,
      slug: record.slug,
      origin: record.origin,
      meaning: record.meaning,
      focusValues: record.focusValues,
      trendIndex: record.trendIndex.monthly,
    };

    const entity = this.favoritesRepository.create({
      userId,
      slug: suggestion.slug,
      name: suggestion.name,
      gender: suggestion.gender,
      origin: suggestion.origin,
      meaning: suggestion.meaning,
      metadata: {
        focusValues: suggestion.focusValues,
        trendIndex: suggestion.trendIndex,
      },
    });

    await this.favoritesRepository.save(entity);
    return 'added';
  }

  async listFavorites(
    userId: string,
    page = 1,
    pageSize = 6,
  ): Promise<FavoriteList> {
    const [items, total] = await this.favoritesRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((item) => ({
        name: item.name,
        gender: item.gender,
        meaning:
          item.meaning ?? this.insightsService.findRecordByName(item.slug)?.meaning,
        origin:
          item.origin ?? this.insightsService.findRecordByName(item.slug)?.origin,
        slug: item.slug,
      })),
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalItems: total,
      pageSize,
    };
  }
}
