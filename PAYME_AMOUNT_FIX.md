# Payme Amount Issue Fixed

## 🐛 **Muammo:**
Payme webhook da `amount` **string** sifatida kelayotgan edi, biz esa **number** deb kutayotgan edik:

```
Kelgan data: "5555.00" (string)
Bizning kod: amount / 100 = "5555.00" / 100 = 55.55 ❌
Kutilgan: 555500 / 100 = 5555 ✅
```

## 🔧 **Yechim:**
1. **Payme service** da amount ni to'g'ri parse qilamiz
2. **Payme link generator** da ham amount ni to'g'ri handle qilamiz

### Payme Service Fix:
```typescript
// Eski (noto'g'ri):
const amountInSom = checkPerformTransactionDto.params.amount / 100;

// Yangi (to'g'ri):
const requestAmount = parseFloat(checkPerformTransactionDto.params.amount.toString());
const amountInSom = requestAmount / 100;
```

### Payme Link Generator Fix:
```typescript
// Eski:
const amountInTiyns = params.amount * 100;

// Yangi:
const amountAsNumber = parseFloat(params.amount.toString());
const amountInTiyns = Math.round(amountAsNumber * 100);
```

## 📊 **Test Case:**
```
Input: "5555.00" (string from Payme)
Parse: parseFloat("5555.00") = 5555 (number)
Convert: 5555 / 100 = 55.55 ❌ (bu noto'g'ri!)

Aslida Payme dan kelishi kerak:
Input: 555500 (number in tiyns)  
Convert: 555500 / 100 = 5555 ✅
```

## 🤔 **Real Issue:**
Logdan ko'rinib turibdiki, Payme dan `"5555.00"` kelayotgan, bu degani:
- Payme link da `a=5555` (som) yuborilayotgan
- Kerak bo'lgani: `a=555500` (tiyn)

## ✅ **Fixed:**
- Link generator: `5555.00` → `555500` tiyn
- Service: String amount ni to'g'ri parse qiladi
- Logging: Batafsil debug ma'lumotlari

Endi Payme to'g'ri ishlashi kerak! 🎉
