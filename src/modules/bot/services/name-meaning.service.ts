import { Injectable } from '@nestjs/common';
import axios from 'axios';
import logger from '../../../shared/utils/logger';

export interface NameMeaning {
    meaning?: string;
    error?: string;
}

@Injectable()
export class NameMeaningService {
    private readonly apiBaseUrl = 'http://94.158.53.20:8080/names_content.php';

    async getNameMeaning(name: string): Promise<NameMeaning> {
        try {
            const response = await axios.get(this.apiBaseUrl, {
                params: {
                    lang_id: 1,
                    name: name.trim()
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.data && typeof response.data === 'string' && response.data.trim()) {
                return { meaning: response.data.trim() };
            } else {
                return { error: 'Bu ism haqida ma\'lumot topilmadi.' };
            }
        } catch (error) {
            logger.error('Name meaning API error:', error);
            return { error: 'Ism manosi olishda xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.' };
        }
    }

    isValidName(name: string): boolean {
        // Check if name contains only letters and spaces, and is not empty
        const nameRegex = /^[a-zA-ZА-Яа-яЁёўўҳҳғғқққ\s]+$/u;
        return nameRegex.test(name.trim()) && name.trim().length > 0 && name.trim().length <= 50;
    }

    formatNameMeaning(name: string, meaning: string): string {
        return `🌟 <b>${name}</b> ismining ma'nosi:\n\n${meaning}\n\nIsmlar manosi botidan foydalanishda davom eting.`;
    }
}
