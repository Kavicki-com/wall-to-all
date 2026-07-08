import {
    validateCPF,
    validateCNPJ,
    validateTime,
    validateDate,
    validateEmail,
    validatePassword,
    sanitizeEmail,
    sanitizePhone,
    sanitizeDocument,
    validatePhone,
    validateCEP,
    validateCity,
    validateAddressNumber,
    validateNeighborhood,
} from '../../lib/validations';

// ─── validateCPF ─────────────────────────────────────────────────────
describe('validateCPF', () => {
    it('accepts a valid CPF (raw digits)', () => {
        expect(validateCPF('52998224725')).toBe(true);
    });

    it('accepts a valid CPF (formatted)', () => {
        expect(validateCPF('529.982.247-25')).toBe(true);
    });

    it('rejects all-same-digit CPFs', () => {
        expect(validateCPF('11111111111')).toBe(false);
        expect(validateCPF('00000000000')).toBe(false);
    });

    it('rejects an invalid CPF', () => {
        expect(validateCPF('12345678901')).toBe(false);
    });

    it('rejects null / undefined / empty', () => {
        expect(validateCPF(null)).toBe(false);
        expect(validateCPF(undefined)).toBe(false);
        expect(validateCPF('')).toBe(false);
    });

    it('rejects overly long strings', () => {
        expect(validateCPF('1'.repeat(21))).toBe(false);
    });
});

// ─── validateCNPJ ────────────────────────────────────────────────────
describe('validateCNPJ', () => {
    it('accepts a valid CNPJ (raw)', () => {
        expect(validateCNPJ('11222333000181')).toBe(true);
    });

    it('accepts a valid CNPJ (formatted)', () => {
        expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
    });

    it('rejects all-same-digit CNPJs', () => {
        expect(validateCNPJ('11111111111111')).toBe(false);
    });

    it('rejects an invalid CNPJ', () => {
        expect(validateCNPJ('12345678000100')).toBe(false);
    });

    it('rejects null / undefined', () => {
        expect(validateCNPJ(null)).toBe(false);
        expect(validateCNPJ(undefined)).toBe(false);
    });
});

// ─── validateEmail ───────────────────────────────────────────────────
describe('validateEmail', () => {
    it('accepts valid emails', () => {
        expect(validateEmail('user@example.com')).toBe(true);
        expect(validateEmail('user+tag@domain.co')).toBe(true);
        expect(validateEmail('first.last@sub.domain.com')).toBe(true);
    });

    it('rejects missing @', () => {
        expect(validateEmail('userdomain.com')).toBe(false);
    });

    it('rejects missing TLD', () => {
        expect(validateEmail('user@domain')).toBe(false);
    });

    it('rejects empty / null-ish', () => {
        expect(validateEmail('')).toBe(false);
    });

    it('trims whitespace before validating', () => {
        expect(validateEmail('  user@example.com  ')).toBe(true);
    });
});

// ─── validatePassword ────────────────────────────────────────────────
describe('validatePassword', () => {
    it('accepts a strong password', () => {
        const result = validatePassword('Abcd1234!');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects empty password', () => {
        const result = validatePassword('');
        expect(result.isValid).toBe(false);
    });

    it('rejects password shorter than 8 chars', () => {
        const result = validatePassword('Ab1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Senha deve ter pelo menos 8 caracteres.');
    });

    it('rejects password without a number', () => {
        const result = validatePassword('Abcdefgh!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Senha deve conter pelo menos um número.');
    });

    it('rejects password without a letter', () => {
        const result = validatePassword('12345678!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Senha deve conter pelo menos uma letra.');
    });

    it('rejects password without a special character', () => {
        const result = validatePassword('Abcdefg1');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Senha deve conter pelo menos um símbolo.');
    });

    it('rejects password with spaces', () => {
        const result = validatePassword('Ab cd 12!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Senha não pode conter espaços.');
    });
});

// ─── validatePhone ───────────────────────────────────────────────────
describe('validatePhone', () => {
    it('accepts valid mobile (11 digits starting with 9)', () => {
        expect(validatePhone('11987654321')).toBe(true);
    });

    it('accepts valid landline (10 digits)', () => {
        expect(validatePhone('1132547698')).toBe(true);
    });

    it('accepts formatted phone', () => {
        expect(validatePhone('(11) 98765-4321')).toBe(true);
    });

    it('rejects all-same digits', () => {
        expect(validatePhone('11111111111')).toBe(false);
    });

    it('rejects too short', () => {
        expect(validatePhone('1234')).toBe(false);
    });

    it('rejects 11-digit number where 3rd digit is not 9', () => {
        expect(validatePhone('11287654321')).toBe(false);
    });
});

// ─── validateTime ────────────────────────────────────────────────────
describe('validateTime', () => {
    it('accepts valid times', () => {
        expect(validateTime('00:00')).toBe(true);
        expect(validateTime('23:59')).toBe(true);
        expect(validateTime('12:30')).toBe(true);
    });

    it('rejects out-of-range times', () => {
        expect(validateTime('24:00')).toBe(false);
        expect(validateTime('12:60')).toBe(false);
    });

    it('rejects malformed strings', () => {
        expect(validateTime('1230')).toBe(false);
        expect(validateTime('abc')).toBe(false);
    });
});

// ─── validateDate ────────────────────────────────────────────────────
describe('validateDate', () => {
    it('accepts a future date', () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        expect(validateDate(future)).toBe(true);
    });

    it('rejects a past date by default', () => {
        const past = new Date('2020-01-01');
        expect(validateDate(past)).toBe(false);
    });

    it('accepts a past date when allowPast is true', () => {
        const past = new Date('2020-01-01');
        expect(validateDate(past, true)).toBe(true);
    });

    it('rejects an invalid Date object', () => {
        expect(validateDate(new Date('invalid'))).toBe(false);
    });
});

// ─── validateCEP ─────────────────────────────────────────────────────
describe('validateCEP', () => {
    it('accepts 8-digit CEP', () => {
        expect(validateCEP('01001000')).toBe(true);
    });

    it('accepts formatted CEP', () => {
        expect(validateCEP('01001-000')).toBe(true);
    });

    it('rejects wrong length', () => {
        expect(validateCEP('1234')).toBe(false);
        expect(validateCEP('123456789')).toBe(false);
    });
});

// ─── validateCity ────────────────────────────────────────────────────
describe('validateCity', () => {
    it('accepts valid city names', () => {
        expect(validateCity('São Paulo')).toBe(true);
        expect(validateCity("Mogi-Guaçu")).toBe(true);
    });

    it('rejects cities with numbers', () => {
        expect(validateCity('City123')).toBe(false);
    });

    it('rejects empty', () => {
        expect(validateCity('')).toBe(false);
    });
});

// ─── validateAddressNumber ───────────────────────────────────────────
describe('validateAddressNumber', () => {
    it('accepts simple numbers', () => {
        expect(validateAddressNumber('123')).toBe(true);
    });

    it('accepts alphanumeric like "10B"', () => {
        expect(validateAddressNumber('10B')).toBe(true);
    });

    it('accepts "s/n" (sem número)', () => {
        expect(validateAddressNumber('s/n')).toBe(true);
        expect(validateAddressNumber('S/N')).toBe(true);
    });

    it('rejects empty', () => {
        expect(validateAddressNumber('')).toBe(false);
    });

    it('rejects strings without digits', () => {
        expect(validateAddressNumber('abc')).toBe(false);
    });
});

// ─── validateNeighborhood ────────────────────────────────────────────
describe('validateNeighborhood', () => {
    it('accepts valid neighborhood', () => {
        expect(validateNeighborhood('Centro')).toBe(true);
        expect(validateNeighborhood('Vila Madalena')).toBe(true);
    });

    it('rejects only numbers', () => {
        expect(validateNeighborhood('12345')).toBe(false);
    });

    it('rejects too short', () => {
        expect(validateNeighborhood('A')).toBe(false);
        expect(validateNeighborhood('')).toBe(false);
    });
});

// ─── sanitizeEmail ───────────────────────────────────────────────────
describe('sanitizeEmail', () => {
    it('trims and lowercases', () => {
        expect(sanitizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    });

    it('returns empty for falsy input', () => {
        expect(sanitizeEmail('')).toBe('');
    });
});

// ─── sanitizePhone ───────────────────────────────────────────────────
describe('sanitizePhone', () => {
    it('strips non-digit chars', () => {
        expect(sanitizePhone('(11) 98765-4321')).toBe('11987654321');
    });

    it('returns empty for falsy input', () => {
        expect(sanitizePhone('')).toBe('');
    });
});

// ─── sanitizeDocument ────────────────────────────────────────────────
describe('sanitizeDocument', () => {
    it('strips formatting', () => {
        expect(sanitizeDocument('529.982.247-25')).toBe('52998224725');
    });

    it('handles null/undefined', () => {
        expect(sanitizeDocument(null)).toBe('');
        expect(sanitizeDocument(undefined)).toBe('');
    });
});
