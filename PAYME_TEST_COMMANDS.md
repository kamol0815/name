# Payme Test Commands

## Test 1: checkPerformTransaction
```bash
curl -X POST http://213.230.110.176:8980/api/payme/merchant \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic UGF5Y29tOlFZNUYjUnBiRE8jNW1SMHlhJlFoYk4zR0F0Tlo4I1RTVUYySSU=" \
  -d '{
    "method": "CheckPerformTransaction",
    "params": {
      "amount": 555500,
      "account": {
        "plan_id": "bb7cac0e-ed39-44bd-8144-c63a39bc4d1d",
        "user_id": "7cf19c94-94dd-4391-8ffa-8ec14cd1caa4"
      }
    },
    "id": 1
  }'
```

## Test 2: createTransaction  
```bash
curl -X POST http://213.230.110.176:8980/api/payme/merchant \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic UGF5Y29tOlFZNUYjUnBiRE8jNW1SMHlhJlFoYk4zR0F0Tlo4I1RTVUYySSU=" \
  -d '{
    "method": "CreateTransaction",
    "params": {
      "id": "test-trans-' $(date +%s) '",
      "time": ' $(date +%s000) ',
      "amount": 555500,
      "account": {
        "plan_id": "bb7cac0e-ed39-44bd-8144-c63a39bc4d1d",
        "user_id": "7cf19c94-94dd-4391-8ffa-8ec14cd1caa4"
      }
    },
    "id": 2
  }'
```

## Expected Results

### checkPerformTransaction Success:
```json
{
  "result": {
    "allow": true
  }
}
```

### createTransaction Success:
```json
{
  "result": {
    "create_time": 1699123456789,
    "transaction": "trans-uuid",
    "state": 1
  }
}
```

## Log Output Expected:
```
💰 Payme amount validation (checkPerformTransaction) {
  planPrice: "5555.00",
  planPriceType: "string", 
  requestAmountInTiyns: 555500,
  requestAmountInSom: 5555
}

🔍 Payme amount comparison {
  amountInSom: 5555,
  planPriceAsNumber: 5555,
  isEqual: true
}

✅ Payme amount validation passed
```
