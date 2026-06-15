# Firestore Security Specification - TDD Spec

This document details the Zero-Trust security invariants, validation targets, and "Dirty Dozen" attack payloads for the Krishok Bazar internal operations database. Since this is an unauthenticated client application running secure local dashboard session validations, the Firestore Security Rules act as the absolute boundary of truth.

---

## 1. Data Invariants

Our business rules govern all interactions with the database collections (`profiles`, `customers`, `orders`, `cost_settings`).

| Collection | Immutable Fields | Security Invariant |
|---|---|---|
| `profiles` | `id`, `phone`, `created_at` | Only unsigned-in users can create profiles, where `approved` is strictly `false` and `role` is strictly `'operator'`. Administrators are seeded in advance or mutated only under secure overrides. Document ID must match the schema's `phone` or `id`. |
| `customers` | `id`, `created_at` | Customers must have unique IDs. Lifecycle accumulators (`total_spent`, `total_orders`, `total_returns`) cannot be set to arbitrary values. |
| `orders` | `id`, `order_date`, `customer_id` | An order represents a transaction. Order `product_cost`, `delivery_cost`, and `other_costs` must be non-negative. Order `amount` must be positive for delivery, and negative for returns. Order `profit` must equal `amount - total_cost` to maintain complete financial transparency. |
| `cost_settings` | `updated_at` | Global constants configuration must occupy a single standard document named `default`. The `product_cost_percent` must fall inside a realistic margin (e.g. 0 to 100). |

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent bypass operations that must be rejected (`PERMISSION_DENIED`) by the Firestore database engine.

### Payload 1: Self-Promoted Administrative Profile
**Attack Vector:** Privilege Escalation upon sign-up.
```json
// Path: /profiles/01777777777 (Method: CREATE)
{
  "id": "01777777777",
  "name": "Malicious Attacker",
  "phone": "01777777777",
  "address": "Dhaka",
  "role": "admin", // ❌ Self-declaring admin role
  "approved": true, // ❌ Self-approving profile
  "password": "attackPassword123",
  "created_at": "2026-06-14T17:00:00.000Z"
}
```

### Payload 2: Ghost Field Injector
**Attack Vector:** Injecting unauthorized telemetry fields into operator profiles.
```json
// Path: /profiles/01888888888 (Method: CREATE)
{
  "id": "01888888888",
  "name": "Operator Joe",
  "phone": "01888888888",
  "address": "Chittagong",
  "role": "operator",
  "approved": false,
  "password": "securePassword456",
  "created_at": "2026-06-14T17:00:00.000Z",
  "is_super_user": true // ❌ Ghost unauthorized schema key
}
```

### Payload 3: Identity Spoofing Mismatch
**Attack Vector:** Writing a document under one phone key whilst claiming another inside the data payload.
```json
// Path: /profiles/01999999999 (Method: CREATE)
{
  "id": "01666666666", // ❌ ID mismatching the path key (01999999999)
  "name": "Identity Thief",
  "phone": "01666666666",
  "address": "Sylhet",
  "role": "operator",
  "approved": false,
  "password": "theftPassword",
  "created_at": "2026-06-14T17:00:00.000Z"
}
```

### Payload 4: Negative Inventory Pricing (Arbitrary Money Injection)
**Attack Vector:** Writing an order with arbitrary negative cost values to simulate high profit margins.
```json
// Path: /orders/ord_neg_value (Method: CREATE)
{
  "id": "ord_neg_value",
  "customer_id": "cust_123",
  "operator_id": "01931355398",
  "amount": 16000,
  "status": "delivery",
  "product_cost": -2000, // ❌ Arbitrarily negative product cost
  "delivery_cost": 500,
  "other_costs": 100,
  "total_cost": -1400,
  "profit": 17400,
  "order_date": "2026-06-14T17:00:00.000Z"
}
```

### Payload 5: Cash Return Amount Discrepancy
**Attack Vector:** Recording a return status with positive cash flows (generating artificial profits).
```json
// Path: /orders/ord_discrepant_return (Method: CREATE)
{
  "id": "ord_discrepant_return",
  "customer_id": "cust_123",
  "operator_id": "01931355398",
  "amount": 16000, // ❌ Positive amount on a "return" order
  "status": "return",
  "product_cost": 4000,
  "delivery_cost": 500,
  "other_costs": 100,
  "total_cost": 4600,
  "profit": 11400,
  "order_date": "2026-06-14T17:00:00.000Z"
}
```

### Payload 6: Profit Tampering (Fake Math Injection)
**Attack Vector:** Fabricating order profitability to skew corporate ledger statements.
```json
// Path: /orders/ord_fake_math (Method: CREATE)
{
  "id": "ord_fake_math",
  "customer_id": "cust_123",
  "operator_id": "01931355398",
  "amount": 16000,
  "status": "delivery",
  "product_cost": 8000,
  "delivery_cost": 1000,
  "other_costs": 500,
  "total_cost": 9500,
  "profit": 15000, // ❌ Fake profit! Correct formula must define profit = 16000 - 9500 = 6500
  "order_date": "2026-06-14T17:00:00.000Z"
}
```

### Payload 7: Customer Metrics Injection
**Attack Vector:** Directly overwriting a customer's cumulative metrics to fake purchase activity.
```json
// Path: /customers/cust_dummy (Method: UPDATE)
{
  "total_spent": 999999, // ❌ Injecting fake lifetime metrics directly from client SDK
  "total_orders": 999
}
```

### Payload 8: Immutable Field Tampering
**Attack Vector:** Altering the creation timestamp of a historical record.
```json
// Path: /customers/cust_123 (Method: UPDATE)
{
  "created_at": "1999-12-31T23:59:59.000Z" // ❌ Overwriting read-only creation date
}
```

### Payload 9: Denial-of-Wallet Character Flooding
**Attack Vector:** Injecting an extremely oversized text string (e.g., a 10MB base-64 image) into a note block.
```json
// Path: /orders/ord_oversized_note (Method: CREATE)
{
  "id": "ord_oversized_note",
  "customer_id": "cust_123",
  "operator_id": "01931355398",
  "amount": 12000,
  "status": "delivery",
  "product_cost": 4000,
  "delivery_cost": 500,
  "other_costs": 100,
  "total_cost": 4600,
  "profit": 7400,
  "order_date": "2026-06-14T17:00:00.000Z",
  "notes": "VERY_LONG_MALICIOUS_CHARACTER_CHAIN_EXCEEDING_LIMIT_..." // ❌ Rejected by string sizing guards
}
```

### Payload 10: Unauthorized Fee Margin Manipulation
**Attack Vector:** Altering cost approximation guidelines to corrupt automatic markup recommendations.
```json
// Path: /cost_settings/default (Method: WRITE)
{
  "product_cost_percent": -50, // ❌ Negative margin setting
  "default_delivery_cost": 0,
  "other_fixed_cost": 0,
  "updated_at": "2026-06-14T17:00:00.000Z"
}
```

### Payload 11: Route Path Pollution (XSS/Unicode Poisoning)
**Attack Vector:** Writing an injected ID on customer directory paths containing malicious symbols.
```json
// Path: /customers/cust_id_<script>alert()</script> (Method: CREATE)
{
  "id": "cust_id_<script>alert()</script>", // ❌ Character set violation
  "name": "Malicious User",
  "phone": "01888888812",
  "total_orders": 0,
  "total_spent": 0,
  "total_returns": 0,
  "created_at": "2026-06-14T17:00:00.000Z"
}
```

### Payload 12: Administrative Status Override
**Attack Vector:** Elevating a standard operator profile to Admin.
```json
// Path: /profiles/01931355398 (Method: UPDATE)
{
  "role": "admin" // ❌ Overriding role properties without full privilege
}
```

---

## 3. Test Cases (TDD Reference Suite)

The automated simulation testing blocks mapping to the Dirty Dozen must satisfy:

```typescript
// Conceptual TDD Assertions (firestore.rules.test.ts)
describe("Krishok Bazar Firestore Guard Rules Test", () => {
  it("rejects unauthorized administrative self-promotion (Payload 1)", async () => {
    await assertFails(
      setDoc(doc(db, "profiles", "01777777777"), {
        id: "01777777777",
        role: "admin", 
        approved: true
      })
    );
  });

  it("fails to write keys outside of the defined blueprint (Payload 2)", async () => {
    await assertFails(
      setDoc(doc(db, "profiles", "01888888888"), {
        id: "01888888888",
        is_super_user: true
      })
    );
  });

  it("fails if payload field ID mismatches path variable (Payload 3)", async () => {
    await assertFails(
      setDoc(doc(db, "profiles", "01999999999"), {
        id: "01666666666"
      })
    );
  });

  it("rejects negative product costs (Payload 4)", async () => {
    await assertFails(
      setDoc(doc(db, "orders", "ord_neg_value"), {
        id: "ord_neg_value",
        product_cost: -2000
      })
    );
  });

  it("rejects discrepant return flows (Payload 5)", async () => {
    await assertFails(
      setDoc(doc(db, "orders", "ord_discrepant_return"), {
        id: "ord_discrepant_return",
        status: "return",
        amount: 8000 // Must be negative on return
      })
    );
  });

  it("rejects fake profitability calculations (Payload 6)", async () => {
    await assertFails(
      setDoc(doc(db, "orders", "ord_fake_math"), {
        id: "ord_fake_math",
        amount: 10000,
        total_cost: 3000,
        profit: 9000 // Expects 7000
      })
    );
  });
});
```
