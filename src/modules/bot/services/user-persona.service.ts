import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPersonaProfileEntity, TargetGender } from '../../../shared/database/entities/user-persona-profile.entity';

export interface PersonaPayload {
  expectedBirthDate?: Date;
  targetGender?: TargetGender;
  familyName?: string;
  parentNames?: string[];
  focusValues?: string[];
  personaType?: string;
  quizAnswers?: Record<string, string>;
}

@Injectable()
export class UserPersonaService {
  constructor(
    @InjectRepository(UserPersonaProfileEntity)
    private readonly personaRepository: Repository<UserPersonaProfileEntity>,
  ) {}

  async getProfile(userId: string): Promise<UserPersonaProfileEntity | null> {
    return this.personaRepository.findOne({ where: { userId } });
  }

  async upsertProfile(userId: string, payload: PersonaPayload): Promise<UserPersonaProfileEntity> {
    const existing = await this.getProfile(userId);
    if (existing) {
      this.personaRepository.merge(existing, {
        ...payload,
        lastPersonalizedAt: new Date(),
      });
      return this.personaRepository.save(existing);
    }

    const entity = this.personaRepository.create({
      userId,
      targetGender: payload.targetGender ?? 'unknown',
      expectedBirthDate: payload.expectedBirthDate,
      familyName: payload.familyName,
      parentNames: payload.parentNames,
      focusValues: payload.focusValues,
      personaType: payload.personaType,
      quizAnswers: payload.quizAnswers,
      lastPersonalizedAt: new Date(),
    });
    return this.personaRepository.save(entity);
  }
}
