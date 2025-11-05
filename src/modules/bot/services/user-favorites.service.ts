import { Injectable } from '@nestjs/common';
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
}

@Injectable()
export class UserFavoritesService {
  constructor(
    @InjectRepository(UserFavoriteNameEntity)
    private readonly favoritesRepository: Repository<UserFavoriteNameEntity>,
    private readonly insights: NameInsightsService,
  ) {}

  async isFavorite(userId: string, slug: string): Promise<boolean> {
    const favorite = await this.favoritesRepository.findOne({
      where: { userId, slug },
    });
    return Boolean(favorite);
  }

  async addToFavorites(userId: string, suggestion: NameSuggestion): Promise<void> {
    const existing = await this.favoritesRepository.findOne({
      where: { userId, slug: suggestion.slug },
    });
    if (existing) {
      return;
    }

    const entity = this.favoritesRepository.create({
      userId,
      slug: suggestion.slug,
      name: suggestion.name,
      gender: suggestion.gender,
      metadata: {
        origin: suggestion.origin,
        meaning: suggestion.meaning,
        focusValues: suggestion.focusValues,
        trendIndex: suggestion.trendIndex,
      },
    });
    await this.favoritesRepository.save(entity);
  }

  async removeFromFavorites(userId: string, slug: string): Promise<void> {
    await this.favoritesRepository.delete({ userId, slug });
  }

  async toggleFavorite(userId: string, slug: string): Promise<'added' | 'removed'> {
    const record = this.insights.findRecordByName(slug);
    const suggestion: NameSuggestion | undefined = record
      ? {
          name: record.name,
          gender: record.gender,
          slug: record.slug,
          origin: record.origin,
          meaning: record.meaning,
          focusValues: record.focusValues,
          trendIndex: record.trendIndex.monthly,
        }
      : undefined;

    if (!suggestion) {
      throw new Error('Ism topilmadi');
    }

    const existing = await this.favoritesRepository.findOne({
      where: { userId, slug: record.slug },
    });

    if (existing) {
      await this.favoritesRepository.remove(existing);
      return 'removed';
    }

    await this.addToFavorites(userId, suggestion);
    return 'added';
  }

  async listFavorites(userId: string, page = 1, pageSize = 6): Promise<FavoriteList> {
    const [items, total] = await this.favoritesRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((item) => ({
        name: item.name,
        gender: item.gender ?? 'unisex',
        meaning:
          (item.metadata?.meaning as string | undefined) ||
          this.insights.findRecordByName(item.name)?.meaning,
        origin:
          (item.metadata?.origin as string | undefined) ||
          this.insights.findRecordByName(item.name)?.origin,
        slug: item.slug,
      })),
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalItems: total,
    };
  }
}
