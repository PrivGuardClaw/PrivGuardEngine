/**
 * Validation algorithms for reducing false positives.
 * Zero dependencies — pure math.
 */

export type ValidatorFn = (value: string) => boolean;

/** Luhn algorithm for bank card numbers */
function luhn(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 12) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/** Chinese 18-digit ID card checksum */
function idcardChecksum(value: string): boolean {
  const cleaned = value.replace(/\s/g, '');
  if (cleaned.length !== 18) return false;

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const digit = parseInt(cleaned[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * weights[i];
  }

  const expected = checkMap[sum % 11];
  return cleaned[17].toUpperCase() === expected;
}

/** US SSN format validation — reject known invalid patterns */
function ssnFormat(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 9) return false;

  const area = parseInt(digits.substring(0, 3), 10);
  const group = parseInt(digits.substring(3, 5), 10);
  const serial = parseInt(digits.substring(5, 9), 10);

  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0) return false;
  if (serial === 0) return false;

  return true;
}

/** Simple length check */
function length11(value: string): boolean {
  return value.replace(/\D/g, '').length === 11;
}

const validators: Record<string, ValidatorFn> = {
  luhn,
  idcard_checksum: idcardChecksum,
  ssn_format: ssnFormat,
  length_11: length11,
};

export function getValidator(name: string): ValidatorFn | undefined {
  return validators[name];
}

export function registerValidator(name: string, fn: ValidatorFn): void {
  validators[name] = fn;
}
