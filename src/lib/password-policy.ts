// lib/password-policy.ts
//
// One rule, kept short on purpose. A password is accepted when it has EITHER
//   - 15 or more characters (any characters, so a short phrase works), OR
//   - 8 or more characters including a lowercase letter and a number.
// It must also fit in 72 bytes (the most Supabase's password hashing reads),
// must not be a very common password, and must not contain the person's own
// name or email. Those last three only show up when they are a problem.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_LONG_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordRuleId =
  | "long"
  | "mix"
  | "max-length"
  | "common"
  | "identity";

/**
 * "option": one of the ways to be long enough (meeting any one is enough).
 * "extra": a rule every password must also meet; only worth showing when broken.
 */
export type PasswordRuleKind = "option" | "extra";

export type PasswordRule = {
  id: PasswordRuleId;
  kind: PasswordRuleKind;
  label: string;
  example?: string;
  test: (password: string) => boolean;
};

export type PasswordRuleResult = {
  id: PasswordRuleId;
  kind: PasswordRuleKind;
  label: string;
  example?: string;
  passed: boolean;
};

export type PasswordValidation = {
  valid: boolean;
  results: PasswordRuleResult[];
};

const IDENTITY_LABEL = "Can't contain your name or email";
const COMMON_LABEL = "Too common, try something harder to guess";

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** The passwords people reach for first. Compared after tidying up the text. */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password", "passw0rd", "pass", "passcode", "qwerty", "qwertyuiop",
  "qwertyui", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm", "abcdef",
  "abcdefg", "abcdefgh", "abc", "abcd", "abcde", "letmein", "welcome",
  "admin", "administrator", "login", "master", "monkey", "dragon",
  "football", "baseball", "basketball", "superman", "batman", "iloveyou",
  "iloveu", "sunshine", "princess", "shadow", "michael", "jessica",
  "charlie", "trustno", "whatever", "freedom", "starwars", "pokemon",
  "minecraft", "roblox", "fortnite", "teacher", "student", "school",
  "quiz", "quizmo", "fili", "filiquizmo", "pilipinas", "philippines",
  "filipino", "mahalkita", "mahalko", "maganda", "kupal", "gagoka",
  "12345", "123456", "1234567", "12345678", "123456789", "1234567890",
  "111111", "000000", "123123", "654321", "987654321", "1q2w3e",
  "1q2w3e4r", "q1w2e3r4", "qazwsx", "default", "changeme", "secret",
  "test", "testing", "guest", "user", "hello", "hellothere", "samplestudent",
]);

/**
 * "Password123!" -> "password", "P@ssw0rd" -> "passw0rd". Strips spacing and
 * punctuation, and any numbers or symbols tacked on the end, so a common word
 * with a number added does not slip through.
 */
function isCommonPassword(password: string): boolean {
  const tidy = password.toLowerCase().replace(/[\s_\-.]+/g, "");
  const leetFixed = tidy
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/!/g, "i")
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s");
  const bases = new Set<string>();

  for (const value of [tidy, leetFixed]) {
    bases.add(value);
    const trimmed = value.replace(/[^a-z]+$/, "");
    if (trimmed.length >= 4) bases.add(trimmed);
  }

  for (const value of bases) {
    if (COMMON_PASSWORDS.has(value)) return true;
  }

  // Digits only, or one character repeated ("aaaaaaaa", "11111111").
  return /^\d+$/.test(tidy) || /^(.)\1+$/.test(tidy);
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "long",
    kind: "option",
    label: `${PASSWORD_LONG_LENGTH}+ characters`,
    example: "any characters, even a phrase",
    test: (password) => password.length >= PASSWORD_LONG_LENGTH,
  },
  {
    id: "mix",
    kind: "option",
    label: `${PASSWORD_MIN_LENGTH}+ characters with a lowercase letter and a number`,
    example: "a-z, 0-9",
    test: (password) =>
      password.length >= PASSWORD_MIN_LENGTH &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password),
  },
  {
    id: "max-length",
    kind: "extra",
    label: "Too long, please shorten it",
    test: (password) => byteLength(password) <= PASSWORD_MAX_LENGTH,
  },
  {
    id: "common",
    kind: "extra",
    label: COMMON_LABEL,
    test: (password) => !isCommonPassword(password),
  },
];

function identityNeedles(identifiers: readonly string[]): string[] {
  const needles: string[] = [];

  for (const identifier of identifiers) {
    const value = identifier.trim().toLowerCase();
    if (!value) continue;

    const at = value.indexOf("@");
    const localPart = at > 0 ? value.slice(0, at) : "";
    // 4+ characters, so short names like "ann" do not reject "channel2024".
    for (const needle of [value, localPart]) {
      if (needle.length >= 4 && !needles.includes(needle)) {
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
          kind: "extra",
          label: IDENTITY_LABEL,
          test: (value) => {
            const normalized = value.toLowerCase();
            return !needles.some((needle) => normalized.includes(needle));
          },
        },
      ]
    : [...PASSWORD_RULES];

  const results = rules.map((rule) => ({
    id: rule.id,
    kind: rule.kind,
    label: rule.label,
    example: rule.example,
    passed: rule.test(password),
  }));

  const longEnough = results.some(
    (result) => result.kind === "option" && result.passed,
  );
  const extrasOk = results.every(
    (result) => result.kind !== "extra" || result.passed,
  );

  return { valid: longEnough && extrasOk, results };
}

/** One plain sentence saying what to fix, for form and API error messages. */
export function passwordProblem(validation: PasswordValidation): string {
  const broken = (id: PasswordRuleId) =>
    validation.results.some((result) => result.id === id && !result.passed);

  if (broken("max-length")) {
    return "Your password is too long. Please shorten it.";
  }
  if (broken("identity")) {
    return "Your password can't contain your name or email.";
  }
  if (broken("common")) {
    return "That password is too common. Try something harder to guess.";
  }

  return `Use ${PASSWORD_LONG_LENGTH} or more characters, or ${PASSWORD_MIN_LENGTH} or more with a lowercase letter and a number.`;
}
