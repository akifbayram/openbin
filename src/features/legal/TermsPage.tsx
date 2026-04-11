import { Link } from 'react-router-dom';
import { useAppSettings } from '@/lib/appSettings';
import { LegalPageLayout, P, Section, UL } from './LegalPageLayout';

export function TermsPage() {
  const { settings } = useAppSettings();
  const appName = settings.appName;

  return (
    <LegalPageLayout title="Terms of Service" crossLink={{ to: '/privacy', label: 'Privacy Policy' }}>
      <Section title="1. Acceptance of Terms">
        <P>
          By accessing or using {appName} ("Service"), you agree to be bound by these Terms of Service ("Terms").
          If you do not agree to these Terms, do not use the Service. We may update these Terms from time to time —
          continued use after changes constitutes acceptance of the revised Terms.
        </P>
      </Section>

      <Section title="2. Description of Service">
        <P>
          {appName} is an inventory management platform that helps users organize physical storage using QR codes,
          photo recognition, and collaborative workspaces. The Service is available as a hosted cloud offering
          and as self-hosted open-source software under the AGPL-3.0 license.
        </P>
      </Section>

      <Section title="3. Eligibility">
        <P>
          You must be at least 16 years old to use the Service. By creating an account, you represent that you
          meet this age requirement and have the legal capacity to enter into these Terms. If you are using the
          Service on behalf of an organization, you represent that you have authority to bind that organization.
        </P>
      </Section>

      <Section title="4. Accounts">
        <P>
          You are responsible for maintaining the confidentiality of your account credentials and for all
          activity that occurs under your account. You agree to:
        </P>
        <UL>
          <li>Provide accurate and complete registration information.</li>
          <li>Keep your password secure and not share it with others.</li>
          <li>Notify us immediately of any unauthorized use of your account.</li>
          <li>Not create accounts through automated means or under false pretenses.</li>
        </UL>
        <P>
          We reserve the right to suspend or terminate accounts that violate these Terms.
        </P>
        <P>
          An account is considered inactive if no login, API call, or other authenticated activity has occurred
          for twelve (12) consecutive months. Before terminating an inactive account, we will send at least one
          notice to the email address on file at least thirty (30) days before the scheduled termination date.
          You may reactivate your account at any time during that notice period by logging in. If you do not
          reactivate within the notice period, your account and its data will be deleted in accordance with our{' '}
          <Link to="/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</Link>.
        </P>
      </Section>

      <Section title="5. Acceptable Use">
        <P>You agree not to use the Service to:</P>
        <UL>
          <li>Violate any applicable law, regulation, or third-party rights.</li>
          <li>Upload or store content that is unlawful, harmful, threatening, abusive, or otherwise objectionable.</li>
          <li>Attempt to gain unauthorized access to the Service, other accounts, or connected systems.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li>Use the Service for competitive benchmarking or to build a competing product.</li>
          <li>Circumvent any usage limits, rate limits, or access controls.</li>
          <li>Transmit malware, viruses, or any code of a destructive nature.</li>
        </UL>
      </Section>

      <Section title="6. Copyright Infringement (DMCA)">
        <P>
          We respect the intellectual property rights of others. If you believe content hosted on the Service
          infringes your copyright, you may submit a takedown notice to our designated DMCA agent:
        </P>
        <P>
          DMCA Agent: <a href="mailto:dmca@openbin.app" className="text-[var(--accent)] hover:underline">dmca@openbin.app</a>
        </P>
        <P>Your notice must include:</P>
        <UL>
          <li>Identification of the copyrighted work you claim is infringed.</li>
          <li>Identification of the material you claim is infringing, with enough detail for us to locate it.</li>
          <li>Your contact information (name, address, phone number, and email).</li>
          <li>A statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
          <li>Your physical or electronic signature.</li>
        </UL>
        <P>
          If your content is removed and you believe the takedown was in error, you may file a counter-notification
          containing: identification of the removed material and its prior location, a statement under penalty of
          perjury that the material was removed by mistake, your name and contact information, and consent to the
          jurisdiction of federal court in your district. We will forward the counter-notification to the
          original complainant, and if they do not file a court action within 10 business days, we may restore
          the material.
        </P>
        <P>
          We will terminate the accounts of users who are determined to be repeat infringers in appropriate
          circumstances.
        </P>
      </Section>

      <Section title="7. Your Data">
        <P>
          You retain full ownership of all content you upload to the Service, including bin data, items, photos,
          notes, and tags ("Your Data"). We do not claim any intellectual property rights over Your Data.
        </P>
        <P>
          You grant us a limited license to host, store, and display Your Data solely for the purpose of providing
          the Service to you. This license ends when you delete Your Data or your account.
        </P>
        <P>
          You may export Your Data at any time using the built-in export functionality. Upon account deletion,
          we will remove Your Data from our active systems in accordance with our data retention practices
          described in our <Link to="/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</Link>.
        </P>
      </Section>

      <Section title="8. AI Features">
        <P>
          The Service offers optional AI-powered features including photo recognition and content suggestions.
          These features may use third-party AI providers (such as OpenAI, Anthropic, or Google) to process
          your data. By using AI features, you acknowledge that:
        </P>
        <UL>
          <li>Relevant bin data and photos may be sent to the AI provider you configure.</li>
          <li>AI-generated suggestions are provided "as is" and may not be accurate.</li>
          <li>You are responsible for reviewing and accepting any AI-generated content.</li>
          <li>Your use of third-party AI services is also subject to those providers' terms.</li>
        </UL>
      </Section>

      <Section title="9. Subscriptions & Billing">
        <P>
          Certain features of the Service require a paid subscription. If you purchase a subscription:
        </P>
        <UL>
          <li>You agree to pay all applicable fees as described at the time of purchase.</li>
          <li>Subscriptions renew automatically unless canceled before the renewal date.</li>
          <li>You may cancel your subscription at any time through your account settings or billing portal.</li>
          <li>We may change pricing with at least 30 days' notice before your next billing cycle.</li>
        </UL>
        <P>
          If payment fails, we may provide a grace period before downgrading your account. Free-tier
          limitations will apply after downgrade.
        </P>
      </Section>

      <Section title="9a. Cancellation & Refund Policy">
        <P>
          <strong>Right of withdrawal (EU/EEA customers).</strong> If you are a consumer in the European Union
          or European Economic Area, you have the right to withdraw from your subscription within 14 days of
          purchase without giving any reason, in accordance with the EU Consumer Rights Directive
          (2011/83/EU). To exercise this right, contact us at{' '}
          <a href="mailto:legal@openbin.app" className="text-[var(--accent)] hover:underline">
            legal@openbin.app
          </a>{' '}
          with a clear statement of your decision to withdraw. We will process your refund within 14 days
          of receiving your withdrawal notice, using the same payment method used for the original purchase.
        </P>
        <P>
          <strong>Cancellation.</strong> When you cancel a subscription, you retain access to paid features
          until the end of your current billing period. No further charges will be made after cancellation.
        </P>
        <P>
          <strong>Prorated refunds.</strong> If you cancel your subscription outside the 14-day withdrawal
          period, you may request a prorated refund for any full, unused months remaining in your current
          billing cycle. Partial months are not refunded. Refund requests must be submitted within 30 days
          of cancellation by contacting{' '}
          <a href="mailto:legal@openbin.app" className="text-[var(--accent)] hover:underline">
            legal@openbin.app
          </a>.
        </P>
        <P>
          <strong>Exceptions.</strong> Refunds are not available where the Service was fully consumed or where
          prohibited by applicable law. Nothing in this section limits any refund rights you may have under
          mandatory consumer protection laws in your jurisdiction.
        </P>
      </Section>

      <Section title="10. Self-Hosted Deployments">
        <P>
          The {appName} server software is available under the AGPL-3.0 license. If you self-host the Service,
          these Terms apply only to your use of our hosted cloud services, customer support, and any
          cloud-connected features. Self-hosted deployments are governed by the AGPL-3.0 license terms.
        </P>
      </Section>

      <Section title="11. Intellectual Property">
        <P>
          The Service, including its design, code (subject to the AGPL-3.0 license), documentation, and branding,
          is owned by {appName} and its contributors. Nothing in these Terms grants you rights to use our
          trademarks, logos, or brand elements without prior written consent.
        </P>
      </Section>

      <Section title="12. Privacy">
        <P>
          Your use of the Service is also governed by our{' '}
          <Link to="/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</Link>,
          which describes how we collect, use, and protect your information.
        </P>
      </Section>

      <Section title="13. Service Availability">
        <P>
          We strive to maintain high availability but do not guarantee uninterrupted access. The Service may
          be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We will
          make reasonable efforts to notify users of planned downtime in advance.
        </P>
      </Section>

      <Section title="14. Termination">
        <P>
          You may delete your account at any time from your profile settings. We may suspend or terminate your
          access if you violate these Terms or if we are required to do so by law. Upon termination:
        </P>
        <UL>
          <li>Your right to access the Service ceases immediately.</li>
          <li>We will delete your account data in accordance with our retention policy.</li>
          <li>
            The following sections will survive termination: Section 7 (Your Data, limited to ownership
            and export rights), Section 11 (Intellectual Property), Section 15 (Disclaimers), Section 16
            (Limitation of Liability), Section 17 (Indemnification), Section 19 (Governing Law), and this
            Section 14 (Termination).
          </li>
        </UL>
      </Section>

      <Section title="15. Disclaimers">
        <P>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          ERROR-FREE, OR SECURE.
        </P>
      </Section>

      <Section title="16. Limitation of Liability">
        <P>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL {appName.toUpperCase()}, ITS AFFILIATES,
          OR CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE,
          REGARDLESS OF THE THEORY OF LIABILITY.
        </P>
        <P>
          Our total aggregate liability for any claims arising from your use of the Service shall not exceed the
          amount you paid us in the twelve (12) months preceding the claim.
        </P>
      </Section>

      <Section title="17. Indemnification">
        <P>
          You agree to indemnify and hold harmless {appName} and its contributors from any claims, damages,
          losses, or expenses (including reasonable legal fees) arising from your use of the Service, your
          violation of these Terms, or your violation of any third-party rights.
        </P>
      </Section>

      <Section title="18. Changes to Terms">
        <P>
          We may modify these Terms at any time. Material changes will be communicated via email or a
          prominent notice within the Service at least 30 days before taking effect. Your continued use of the
          Service after changes become effective constitutes acceptance of the updated Terms.
        </P>
      </Section>

      <Section title="19. Governing Law">
        <P>
          These Terms are governed by the laws of the State of Delaware, United States, without regard to
          conflict of law principles. Any disputes arising from these Terms shall be resolved in the state
          or federal courts located in Delaware.
        </P>
      </Section>

      <Section title="20. Contact">
        <P>
          If you have questions about these Terms, please contact us at{' '}
          <a href="mailto:legal@openbin.app" className="text-[var(--accent)] hover:underline">
            legal@openbin.app
          </a>.
        </P>
      </Section>
    </LegalPageLayout>
  );
}
