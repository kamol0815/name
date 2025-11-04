# Payment Providers Amount Format Summary

## Hozirgi format (5555 so'm plan uchun)

### 📊 **Database Storage**
- Plan price: `"5555.00"` (decimal type in PostgreSQL)
- Type: `typeof plan.price === "string"` (TypeORM dan string sifatida keladi)

### 🔄 **Payment Provider Formats**

| Provider | Expected Format | Our Conversion | Final Amount | Status |
|----------|----------------|----------------|--------------|--------|
| **Click** | `5555` (integer) | `parseInt("5555.00")` | `5555` | ✅ |
| **Payme** | `5555.00` (decimal) | `parseFloat("5555.00")` | `5555` | ✅ |
| **UzCard** | `5555` (integer) | `parseInt("5555.00")` | `5555` | ✅ |

### 📝 **Detailed Flow**

#### 1. **Click Payment**
```typescript
// Click da integer format kerak
const clickAmount = parseInt(`${plan.price}`);  // "5555.00" → 5555
if (parseInt(`${amount}`) !== parseInt(`${plan.price}`)) {
  // Error: amount mismatch
}
```

#### 2. **Payme Payment** 
```typescript
// Payme da decimal format, lekin tiyn sifatida yuboriladi
// Bot: plan.price (5555.00) → Link: 5555 * 100 = 555500 tiyn
// Webhook: 555500 tiyn → 555500 / 100 = 5555.00 som
const amountInSom = payme.amount / 100;  // 555500 / 100 = 5555
const planPrice = parseFloat(plan.price.toString());  // "5555.00" → 5555
if (amountInSom !== planPrice) {
  // Error: amount mismatch  
}
```

#### 3. **UzCard Payment**
```typescript
// UzCard da integer format kerak
const uzcardAmount = parseInt(`${plan.price}`);  // "5555.00" → 5555
const payload = {
  amount: uzcardAmount  // 5555 (integer)
};
```

### ✅ **Test Cases**

#### Payme Test:
```
Input: 555500 tiyns
Conversion: 555500 / 100 = 5555 som
Plan Price: parseFloat("5555.00") = 5555
Result: 5555 === 5555 ✅
```

#### Click Test:
```
Input: "5555.00" 
Conversion: parseInt("5555.00") = 5555
Plan Price: parseInt("5555.00") = 5555  
Result: 5555 === 5555 ✅
```

#### UzCard Test:
```
Plan Price: "5555.00"
Conversion: parseInt("5555.00") = 5555
Payload: { amount: 5555 }
Result: UzCard API gets integer ✅
```

### 🚀 **Current Status**
- ✅ **Click**: Integer format working
- ✅ **Payme**: Decimal format (via tiyns) working  
- ✅ **UzCard**: Integer format working

All payment providers now handle amounts correctly according to their specific requirements!
