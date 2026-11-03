import type { Metadata } from "next";
import { PolicyPage, type PolicySection, PolicyList, policyReturnTo } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Privacy Notice | Fili-QuizMo",
};

const sections: PolicySection[] = [
  {
    id: "controller",
    title: "1. Who is responsible",
    content: (
      <p>
        Fili-QuizMo Team, at 109 Samson Road corner Caimito Road, Caloocan, Philippines, is responsible for
        personal data processed through Fili-QuizMo.
      </p>
    ),
  },
  {
    id: "data",
    title: "2. Personal data we process",
    content: (
      <PolicyList>
        <li>
          Account details such as name or username, email address, and account
          role.
        </li>
        <li>
          School or class details, where provided by a user, teacher, or school.
        </li>
        <li>
          Quiz participation, answers, scores, attempts, and learning activity.
        </li>
        <li>
          Device, connection, and service-log information generated when the
          app and its hosting or authentication services are used.
        </li>
      </PolicyList>
    ),
  },
  {
    id: "purposes",
    title: "3. Purposes and legal bases",
    content: (
      <p>
        We use this information to create and secure accounts, provide quizzes
        and dashboards, show learning results to authorized users, support
        teachers and administrators, troubleshoot the service, and meet legal
        obligations. Depending on the context, processing is based on your
        consent, steps needed to provide the service, legitimate interests in
        operating and protecting an educational platform, or another lawful
        basis under Republic Act No. 10173.
      </p>
    ),
  },
  {
    id: "access",
    title: "4. Who may access data",
    content: (
      <p>
        Students can view their own quiz activity. Teachers may view information
        about students and quizzes within their authorized classes. Authorized
        administrators may access records for platform administration and
        support. Access is subject to account roles and applicable database
        controls. We do not make student results public.
      </p>
    ),
  },
  {
    id: "processors",
    title: "5. Service providers",
    content: (
      <p>
        Supabase provides authentication and database hosting services for the
        application. Providers process information only as needed to deliver
        their services and under their applicable terms and safeguards.
        Additional providers, if introduced, will be identified in an updated
        notice.
      </p>
    ),
  },
  {
    id: "retention",
    title: "6. Retention",
    content: (
      <p>
        We retain account information and educational records for as long as
        needed to provide the service, meet school or legal requirements, and
        resolve disputes. 
      </p>
    ),
  },
  {
    id: "security",
    title: "7. Security",
    content: (
      <p>
        We use authentication, role-based access controls, and database access
        policies to help protect information. No online service can guarantee
        absolute security. 
      </p>
    ),
  },
  {
    id: "rights",
    title: "8. Your data privacy rights",
    content: (
      <>
        <p>
          Subject to the Data Privacy Act of 2012 and its implementing rules,
          you may exercise the right to be informed, access, object, rectify,
          erasure or blocking, data portability, damages, and to file a
          complaint with the National Privacy Commission.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "9. Children and student data",
    content: (
      <p>
        The platform may be used by minors for learning. A parent or guardian,
        or a school acting with appropriate authority, should review this
        notice and provide any required permission before a minor creates or
        uses an account. We ask users not to provide more personal information
        than needed for learning.
      </p>
    ),
  },
  {
    id: "breaches",
    title: "10. Personal data breaches",
    content: (
      <p>
        We will assess suspected personal data breaches and notify affected
        individuals and the National Privacy Commission when required by the
        Data Privacy Act and applicable regulations. Notifications will be
        made within the legally required period.
      </p>
    ),
  },
  {
    id: "changes-contact",
    title: "11. Updates and contact",
    content: (
      <p>
        This notice may be updated when our practices or legal obligations
        change. Contact JASE, 109 Samson Road corner Caimito Road, Caloocan, Philippines.
      </p>
    ),
  },
];

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <PolicyPage
      title="Privacy Notice"
      description="How Fili-QuizMo handles personal information under the Data Privacy Act of 2012 (Republic Act No. 10173)."
      returnTo={policyReturnTo(params)}
      sections={sections}
    />
  );
}
