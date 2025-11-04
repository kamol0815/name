# VIP User Experience Guide

## Botning ishlash tartibi

### 1. Oddiy foydalanuvchi (VIP emas)
- Foydalanuvchi bot ishga tushganida `/start` buyrug'i orqali salomlashadi
- Asosiy menyuda "🌟 Ism manosi" tugmasini bosadi
- Ism yozganda bot to'lov qilishni talab qiladi:
  ```
  🔒 Ism manosini ko'rish uchun to'lov qiling
  
  💵 Narx: 5555 so'm
  ♾️ Bir marta to'lov - umrbod foydalaning!
  
  To'lov qilganingizdan so'ng barcha ismlar manosi ochiladi.
  ```

### 2. To'lov jarayoni
Foydalanuvchi "💳 To'lov qilish" tugmasini bosganda:

#### To'lov provayderi tanlash:
- 💳 UzCard
- 🟢 Click 
- 💙 Payme

#### To'lov amalga oshishi:
1. Foydalanuvchi to'lov provayderini tanlaydi
2. To'lov linkiga o'tadi va karta ma'lumotlarini kiritadi
3. To'lov muvaffaqiyatli bo'lsa, bot avtomatik xabar yuboradi:
   ```
   🎉 Tabriklaymiz!
   
   ✅ To'lov muvaffaqiyatli amalga oshirildi!
   💰 Summa: 5555 so'm
   📦 Reja: Basic
   
   🌟 Endi siz VIP foydalanuvchisiz!
   ♾️ Barcha ismlar manosi umrbod ochiq!
   
   Botdan bemalol foydalanishingiz mumkin! 🚀
   ```

### 3. VIP foydalanuvchi (To'lov qilgan)
- Foydalanuvchi istalgan ismni yozganda bot darhol javob beradi
- Hech qanday to'lov so'ralmaydi
- Ismning ma'nosini chiroyli formatda ko'rsatadi:

```
🌟 Kamoliddin

📖 Ma'nosi: Dinda komil, mukammal

✨ Boshqa ism → 🌟 Boshqa ism
🔙 Asosiy menyu
```

### 4. Umrbod obuna (Lifetime Subscription)
- Bir marta to'lov qilgandan so'ng foydalanuvchi **100 yil** davomida VIP bo'ladi
- Bu amalda umrbod demakdir
- Foydalanuvchi ma'lumotlar bazasida quyidagicha saqlanadi:
  - `isActive: true`
  - `subscriptionEnd: 2125-yil` (100 yil keyingi sana)

## Texnik implementatsiya

### Database changes (to'lov amalga oshganda):
```sql
UPDATE users SET 
  isActive = true,
  subscriptionEnd = '2125-11-04T00:00:00.000Z'  -- 100 yil keyin
WHERE telegramId = 123456789;
```

### VIP tekshirish logikasi:
```typescript
const isVIP = user && user.isActive && 
              user.subscriptionEnd && 
              new Date(user.subscriptionEnd) > new Date();
```

## Barcha to'lov provayderlari

### Click Payment
- **Format**: `5555.00` → `parseInt()` orqali `5555` ga aylantiriladi
- **Webhook**: 2 ta webhook keladi (prepare va complete)
- **Success**: User avtomatik VIP qilinadi

### Payme Payment  
- **Format**: `555500` (tiyn) → `/100` orqali `5555` som ga aylantiriladi
- **Webhook**: Transaction state Machine orqali boshqariladi
- **Success**: User avtomatik VIP qilinadi

### UzCard Payment
- **Format**: `5555` (som)
- **Flow**: OTP verification orqali
- **Success**: User avtomatik VIP qilinadi

## Foydalanuvchi experience

1. **Oddiy foydalanuvchi**: Har safar ism so'raganda to'lov talab qilinadi
2. **VIP foydalanuvchi**: Istalgan vaqtda istalgan ismni so'rashi mumkin
3. **To'lov**: Bir marta to'lov - umrbod foydalanish
4. **Notification**: To'lov muvaffaqiyatli bo'lsa darhol xabardor qilinadi
5. **Access**: VIP foydalanuvchi bot qaytatartilganda ham VIP bo'lib qoladi

## Testing scenarios

### Test 1: Oddiy foydalanuvchi
```
User: "Kamoliddin"
Bot: "🔒 Ism manosini ko'rish uchun to'lov qiling..."
```

### Test 2: To'lov jarayoni
```
User: [To'lov qiladi]
Bot: "🎉 Tabriklaymiz! Endi siz VIP foydalanuvchisiz!"
```

### Test 3: VIP foydalanuvchi
```
User: "Oisha"  
Bot: "🌟 Oisha \n📖 Ma'nosi: Hayotdagi eng yaxshi..."
```

### Test 4: VIP status tekshiruvi
```
User: [To'lov tugmasini bosadi]
Bot: "✅ Siz allaqachon VIP foydalanuvchisiz!"
```
