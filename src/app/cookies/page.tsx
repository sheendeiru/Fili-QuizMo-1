import type { Metadata } from "next";
import { PolicyPage, type PolicySection, PolicyList, policyReturnTo } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Cookie Policy | Fili-QuizMo",
};

const sections: PolicySection[] = [
  {
    id: "what-we-use",
    title: "1. Cookies and browser storage we use",
    content: (
      <>
        <p>
          Fili-QuizMo uses strictly necessary authentication cookies managed by
          Supabase to maintain sign-in sessions and protect authenticated
          requests. Cookie names and expiry are controlled by the active
          Supabase project configuration.
        </p>
        <PolicyList>
          <li>
            Supabase authentication cookies — strictly necessary for account
            sign-in and session continuity; session duration follows the
            configured authentication policy.
          </li>
          <li>
            Browser local and session storage — used for session coordination
            and remembering that you dismissed this cookie notice. These are
            not advertising cookies.
          </li>
        </PolicyList>
      </>
    ),
  },
  {
    id: "tracking",
    title: "2. Analytics and advertising",
    content: (
      <p>
        The current application code does not load advertising trackers or
        third-party analytics tags. If that changes, this policy will be
        updated and any required consent mechanism will be added before
        non-essential tracking is enabled.
      </p>
    ),
  },
  {
    id: "control",
    title: "3. Managing cookies",
    content: (
      <p>
        You can clear cookies and site storage through your browser&apos;s
        privacy settings. Clearing authentication cookies will sign you out;
        clearing site storage may also reset local session coordination and
        the cookie-notice dismissal preference. Blocking necessary cookies may
        prevent sign-in from working.
      </p>
    ),
  },
  {
    id: "contact",
    title: "4. Contact",
    content: (
      <p>
        Questions about this policy may be sent to [ORGANIZATION NAME] at
        [CONTACT EMAIL]. Effective date: [EFFECTIVE DATE].
      </p>
    ),
  },
];

export default async function CookiesPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <PolicyPage
      title="Cookie Policy"
      description="Information about authentication cookies and browser storage used by Fili-QuizMo."
      returnTo={policyReturnTo(params)}
      sections={sections}
    />
  );
}
