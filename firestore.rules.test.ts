import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8')) as {
  entities: Record<string, { required?: string[]; properties: Record<string, unknown> }>;
  firestore: Record<string, unknown>;
};

describe('Firestore Security Rules & Blueprint Integrity (Eight Pillars + Dirty Dozen)', () => {
  it('enforces rules_version 2 and default-deny global safety net', () => {
    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('has a dedicated match block and validation helper for every blueprint collection', () => {
    const expectedMatches = [
      'match /users/{userId}',
      'match /accounts/{accountId}',
      'match /categories/{categoryId}',
      'match /cards/{cardId}',
      'match /transactions/{transactionId}',
      'match /transfers/{transferId}',
      'match /invoicePayments/{paymentId}',
      'match /recurrences/{recurrenceId}',
      'match /budgets/{budgetId}',
      'match /goals/{goalId}',
      'match /debts/{debtId}',
      'match /assets/{assetId}',
    ];
    for (const block of expectedMatches) {
      expect(rulesContent).toContain(block);
    }

    const expectedHelpers = [
      'isValidUserSettings',
      'isValidAccount',
      'isValidCategory',
      'isValidCreditCard',
      'isValidTransaction',
      'isValidTransfer',
      'isValidInvoicePayment',
      'isValidRecurrence',
      'isValidBudget',
      'isValidGoal',
      'isValidDebt',
      'isValidAsset',
    ];
    for (const helper of expectedHelpers) {
      expect(rulesContent).toContain(`function ${helper}(`);
    }
  });

  it('blocks Dirty Dozen 1-6: cross-tenant access, shadow fields, ID poisoning, email spoofing, and blanket list', () => {
    // 1 & 2: Owner & userId body enforcement
    expect(rulesContent).toContain('request.auth.uid == userId');
    expect(rulesContent).toContain('data.userId == userId');

    // 3: Shadow field rejection via hasAll + hasOnly
    expect(rulesContent).toContain('data.keys().hasAll(');
    expect(rulesContent).toContain('data.keys().hasOnly(');
    expect(rulesContent).toContain('affectedKeys().hasOnly(');

    // 4: ID Poisoning guard on path variables
    expect(rulesContent).toContain("id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$')");

    // 5: Email spoofing guard (non-anonymous users must have email_verified == true)
    expect(rulesContent).toContain("request.auth.token.firebase.sign_in_provider == 'anonymous'");
    expect(rulesContent).toContain('request.auth.token.email_verified == true');

    // 6: Zero blanket list on /users and resource.data enforcement on all subcollection lists
    expect(rulesContent).toContain('allow list: if false;');
    expect(rulesContent).toContain('allow list: if isOwner(userId) && resource.data.userId == request.auth.uid;');
  });

  it('blocks Dirty Dozen 7-12: timestamp forgery, immutable mutation, self-transfer, orphans, negative int, terminal state bypass', () => {
    // 7: Server timestamp enforcement
    expect(rulesContent).toContain('incoming().createdAt == request.time');
    expect(rulesContent).toContain('incoming().updatedAt == request.time');

    // 8: Immutable owner & createdAt
    expect(rulesContent).toContain('incoming().userId == existing().userId');
    expect(rulesContent).toContain('incoming().createdAt == existing().createdAt');

    // 9: Self-transfer blocked
    expect(rulesContent).toContain('data.fromAccountId != data.toAccountId');

    // 10: Referential integrity via existsAfter
    expect(rulesContent).toContain('existsAfter(/databases/$(database)/documents/users/$(userId)/accounts/');
    expect(rulesContent).toContain('existsAfter(/databases/$(database)/documents/users/$(userId)/cards/');
    expect(rulesContent).toContain('existsAfter(/databases/$(database)/documents/users/$(userId)/categories/');

    // 11: Integer bounds check (no negative/float transaction amounts)
    expect(rulesContent).toContain('isSafeInt(data.amountCents, 1, 100000000000)');

    // 12: Terminal state locking on goals and debts
    expect(rulesContent).toContain("existing().status == 'active'");
    expect(rulesContent).toContain("existing().status == 'completed' && incoming().status == 'active'");
    expect(rulesContent).toContain("existing().status == 'paid' && incoming().status == 'active'");
  });

  it('contains zero PII fields in blueprint entities (no CPF, RG, cardNumber, CVV)', () => {
    const bannedFields = ['cpf', 'rg', 'cvv', 'cardNumber', 'pan', 'address', 'phone'];
    for (const [name, entity] of Object.entries(blueprint.entities)) {
      for (const field of Object.keys(entity.properties)) {
        expect(bannedFields, `Unexpected PII field ${field} in ${name}`).not.toContain(field);
      }
    }
  });
});
