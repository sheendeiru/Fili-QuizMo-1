export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordRuleId =
  | "min-length"
  | "max-length"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special"
  | "identity";

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  example?: string;
  test: (password: string) => boolean;
};

export type PasswordRuleResult = {
  id: PasswordRuleId;
  label: string;
  example?: string;
  passed: boolean;
};

export type PasswordValidation = {
  valid: boolean;
  results: PasswordRuleResult[];
};

const IDENTITY_LABEL = "No name/email";

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "min-length",
    label: `${PASSWORD_MIN_LENGTH}+ characters`,
    example: "sunshine",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "Uppercase",
    example: "A-Z",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "Lowercase",
    example: "a-z",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "Number",
    example: "0-9",
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "Symbol",
    example: "!@#$",
    test: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
  {
    id: "max-length",
    label: "Too long - shorten it",
    test: (password) => byteLength(password) <= PASSWORD_MAX_LENGTH,
  },
];

function identityNeedles(identifiers: readonly string[]): string[] {
  const needles: string[] = [];

  for (const identifier of identifiers) {
    const value = identifier.trim().toLowerCase();
    if (!value) continue;

    const at = value.indexOf("@");
    const localPart = at > 0 ? value.slice(0, at) : "";
    for (const needle of [value, localPart]) {
      if (needle.length >= 3 && !needles.includes(needle)) {
        needles.push(needle);
      }
    }
  }

  return needles;
}

/** Single source of truth for client hints and server-side validation. */
export function validatePassword(
  password: string,
  identifiers: readonly string[] = [],
): PasswordValidation {
  const needles = identityNeedles(identifiers);
  const rules: PasswordRule[] = needles.length
    ? [
        ...PASSWORD_RULES,
        {
          id: "identity",
          label: IDENTITY_LABEL,
          example: "not yours",
          test: (value) => {
            const normalized = value.toLowerCase();
            return !needles.some((needle) => normalized.includes(needle));
          },
        },
      ]
    : [...PASSWORD_RULES];

  const results = rules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    example: rule.example,
    passed: rule.test(password),
  }));

  return {
    valid: results.every((result) => result.passed),
    results,
  };
}
