type PolicyConsentProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function PolicyConsent({
  id,
  checked,
  onChange,
}: PolicyConsentProps) {
  const statementId = `${id}-statement`;
  const termsId = `${id}-terms`;
  const privacyId = `${id}-privacy`;
  const hintId = `${id}-hint`;

  return (
    <div className="border-2 border-px-cream-border bg-px-cream-shade p-3 text-sm text-px-text-dark">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
          required
          aria-required="true"
          aria-labelledby={`${statementId} ${termsId} ${privacyId}`}
          aria-describedby={hintId}
          className="mt-1 h-5 w-5 shrink-0 accent-px-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-indigo"
        />
        <div className="leading-6">
          <label id={statementId} htmlFor={id} className="mr-1 cursor-pointer">
            I have read and agree to the
          </label>
          <a
            id={termsId}
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-px-indigo underline decoration-2 underline-offset-2 hover:text-px-indigo-lt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-indigo"
          >
            Terms and Conditions
          </a>
          <span className="mx-1">and the</span>
          <a
            id={privacyId}
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-px-indigo underline decoration-2 underline-offset-2 hover:text-px-indigo-lt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-indigo"
          >
            Privacy Notice (Data Privacy Act of 2012)
          </a>
          <p
            id={hintId}
            aria-live="polite"
            className="mt-1 text-xs font-semibold text-px-text-dark"
          >
            {checked ? "Thank you for confirming." : "Required before continuing."}
          </p>
        </div>
      </div>
    </div>
  );
}
