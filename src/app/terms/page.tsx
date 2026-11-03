import type { Metadata } from "next";
import { PolicyPage, type PolicySection, PolicyList, policyReturnTo } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Terms and Conditions | Fili-QuizMo",
};

const sections: PolicySection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of these terms",
    content: (
      <p>
        These Terms and Conditions govern your use of Fili-QuizMo, operated by
        JASE. By creating an account or using the platform, you
        agree to these terms and our Privacy Notice. If you do not agree, do
        not use the platform.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility and accounts",
    content: (
      <>
        <p>
          Fili-QuizMo is intended for educational use. You must provide
          accurate account information and protect your login credentials.
        </p>
        <p>
          Users under 18 may use the service only with permission and
          appropriate supervision from a parent or legal guardian, or through
          their school with the school&apos;s authorization and applicable
          safeguards.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    content: (
      <PolicyList>
        <li>Use the service lawfully and for educational purposes.</li>
        <li>Do not attempt to access another person&apos;s account or data.</li>
        <li>
          Do not disrupt, probe, reverse engineer, or interfere with the
          platform or its security controls.
        </li>
        <li>
          Do not upload unlawful, abusive, misleading, or infringing material.
        </li>
      </PolicyList>
    ),
  },
  {
    id: "content",
    title: "4. Quizzes and content ownership",
    content: (
      <p>
        Users retain rights they hold in content they submit. You grant
        JASE permission to host, display, and process submitted
        quiz content only as needed to operate, secure, and improve the
        educational service. Do not submit material unless you have permission
        to use it. The platform name, software, and original interface remain
        the property of their respective rights holders.
      </p>
    ),
  },
  {
    id: "responsibilities",
    title: "5. Teacher and administrator responsibilities",
    content: (
      <p>
        Teachers are responsible for the accuracy and appropriateness of
        quizzes they create, managing student access appropriately, and
        following their school&apos;s rules. Administrators are responsible for
        authorized account management and should access student data only for
        legitimate educational or operational purposes.
      </p>
    ),
  },
  {
    id: "termination",
    title: "6. Suspension and termination",
    content: (
      <p>
        JASE may restrict or suspend access when reasonably
        necessary to protect users, comply with law, address misuse, or secure
        the service. Where appropriate, we will provide notice and an
        opportunity to address the issue. You may stop using the service at any
        time and request account handling through the contact below.
      </p>
    ),
  },
  {
    id: "disclaimer",
    title: "7. Availability and disclaimers",
    content: (
      <p>
        The platform is provided for educational support and is not a substitute
        for professional instruction, school policies, or official assessment.
        We work to keep it available and accurate but do not guarantee
        uninterrupted or error-free service.
      </p>
    ),
  },
  {
    id: "liability",
    title: "8. Limitation of liability",
    content: (
      <p>
        To the extent allowed by Philippine law, JASE is not
        liable for indirect or consequential loss arising from use of the
        service. Nothing in these terms excludes liability that cannot
        lawfully be excluded or limits rights that cannot be waived.
      </p>
    ),
  },
  {
    id: "changes",
    title: "9. Changes to these terms",
    content: (
      <p>
        We may revise these terms as the service or applicable law changes.
        Material updates will be posted here with a revised effective date.
        Continued use after an update means you accept the revised terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "10. Governing law and contact",
    content: (
      <>
        <p>
          These terms are governed by the laws of the Republic of the
          Philippines, subject to mandatory consumer and data protection
          rights.
        </p>
        <p>
          Questions: JASE, 109 Samson Road corner Caimito Road, Caloocan, Philippines.
        </p>
      </>
    ),
  },
];

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <PolicyPage
      title="Terms and Conditions"
      description="Rules for using Fili-QuizMo for educational quizzes and learning."
      returnTo={policyReturnTo(params)}
      sections={sections}
    />
  );
}
