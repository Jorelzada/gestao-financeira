# FinanceFlow Security Specification

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document lives under `/users/{userId}` (or a subcollection beneath it) where `userId == request.auth.uid`, and every document body contains `userId == request.auth.uid`.
2. **Verified or Explicit Anonymous Identity**: Clients must be authenticated either as an explicit anonymous session (`sign_in_provider == 'anonymous'`) or a verified federated/email identity (`email_verified == true`).
3. **Immutable Ownership & Creation Timestamps**: `userId` and `createdAt` can never be changed after creation; `createdAt` and `updatedAt` must equal `request.time`.
4. **Strict Integer Cents & Numeric Bounds**: Monetary values (`amountCents`, `limitCents`, `initialBalanceCents`, `targetCents`, `currentCents`, `totalCents`, `remainingCents`, `monthlyPaymentCents`, `valueCents`) must be integers within realistic safe bounds (`>= 0` for positive amounts, bounded within `[-100000000000, 100000000000]`).
5. **Relational & Business Integrity**:
   - A `Transfer` cannot have `fromAccountId == toAccountId`, and both referenced accounts must exist under the same user on create.
   - A `Transaction` with `paymentMethod == 'account'` must reference an existing `accountId` under the same user on create; with `paymentMethod == 'card'`, it must reference an existing `cardId` under the same user on create.
   - An `InvoicePayment` must reference existing `cardId` and `accountId` under the same user on create.
   - A `Budget` must reference an existing `categoryId` under the same user on create.
6. **Zero PII & Zero Payment Credentials**: No collection accepts `cpf`, `rg`, `cvv`, `cardNumber`, `address`, `phone`, or `email` fields; `hasOnly(...)` blocks any shadow/extra fields.
7. **Terminal State Locking**: Completed goals (`status == 'completed'`) and paid debts (`status == 'paid'`) lock against further state-mutating balance modifications unless reopened explicitly or deleted.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Cross-Tenant Read/Write**: User B attempts `create` or `get` on `/users/userA/accounts/acc1`.
2. **Identity Spoofing in Body**: User A creates `/users/userA/accounts/acc1` with `data.userId = "userB"`.
3. **Shadow Field Injection**: User A creates an account with an extra ghost field `isAdmin: true` or `cpf: "12345678900"`.
4. **ID Poisoning (1.5KB Document ID)**: User A attempts `create` at `/users/userA/accounts/<200-char-invalid-id!@#>` violating `isValidId`.
5. **Unverified Email Spoofing**: Authenticated token with `email_verified: false` (non-anonymous) attempts write.
6. **Blanket Collection List**: User B runs `list` on `/users/userA/transactions` or `/users` root.
7. **Timestamp Forgery**: Client submits `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
8. **Immutable Field Mutation**: Client updates `userId` or `createdAt` on an existing transaction.
9. **Self-Transfer Bypass**: Client creates a `Transfer` where `fromAccountId == toAccountId`.
10. **Orphaned Transaction Reference**: Client creates a `Transaction` with `accountId: "nonexistent_acc"` that does not exist in `/users/{uid}/accounts`.
11. **Negative Amount Poisoning**: Client creates a `Transaction` with `amountCents: -5000` or float `amountCents: 12.34`.
12. **Terminal State Bypass**: Client modifies `currentCents` on a `Goal` whose existing `status == "completed"` without reopening it.
