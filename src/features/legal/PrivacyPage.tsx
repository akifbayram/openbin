import { useAppSettings } from '@/lib/appSettings';
import { LegalPageLayout, P, Section, UL } from './LegalPageLayout';

export function PrivacyPage() {
  const { settings } = useAppSettings();
  const appName = settings.appName;

  return (
    <LegalPageLayout title="Privacy Policy" crossLink={{ to: '/terms', label: 'Terms of Service' }}>
      <Section title="1. Introduction">
        <P>
          This Privacy Policy explains how {appName} ("we", "us", "our") collects, uses, stores, and protects
          your information when you use our inventory management platform ("Service"). We are committed to
          protecting your privacy and handling your data responsibly.
        </P>
        <P>
          By using the Service, you agree to the collection and use of information as described in this policy.
          If you do not agree, please do not use the Service.
        </P>
      </Section>

      <Section title="2. Information We Collect">
        <P>We collect the following categories of information:</P>

        <h3 className="font-heading text-[15px] font-semibold text-[var(--text-primary)] pt-2">Account Information</h3>
        <UL>
          <li>Email address (required) and display name (required).</li>
          <li>Password (stored as a salted hash — we never store plaintext passwords).</li>
        </UL>

        <h3 className="font-heading text-[15px] font-semibold text-[var(--text-primary)] pt-2">Content You Create</h3>
        <UL>
          <li>Bins, items, notes, tags, and custom fields you add to your inventory.</li>
          <li>Photos you upload for bin identification and AI analysis.</li>
          <li>Location and area organizational structures.</li>
          <li>QR code configurations and label preferences.</li>
        </UL>

        <h3 className="font-heading text-[15px] font-semibold text-[var(--text-primary)] pt-2">Usage Data</h3>
        <UL>
          <li>Activity logs within your locations (e.g., bin created, item added).</li>
          <li>Scan history when you use the QR scanner.</li>
          <li>Feature usage for service improvement (aggregated and anonymized).</li>
        </UL>

        <h3 className="font-heading text-[15px] font-semibold text-[var(--text-primary)] pt-2">Technical Data</h3>
        <UL>
          <li>IP address and browser user agent (for security and rate limiting).</li>
          <li>Device type and screen size (for responsive layout optimization).</li>
        </UL>
      </Section>

      <Section title="3. How We Use Your Information">
        <P>We use your information to:</P>
        <UL>
          <li>Provide, operate, and maintain the Service.</li>
          <li>Authenticate your identity and secure your account.</li>
          <li>Process your inventory data and deliver search, sorting, and organization features.</li>
          <li>Enable collaboration with other members of your locations.</li>
          <li>Send transactional emails (password resets, account notifications).</li>
          <li>Improve the Service based on aggregated usage patterns.</li>
          <li>Enforce our Terms of Service and protect against abuse.</li>
        </UL>
        <P>
          We do <strong>not</strong> sell your personal information. We do <strong>not</strong> use your data for
          advertising. We do <strong>not</strong> train AI models on your data.
        </P>
      </Section>

      <Section title="4. Legal Basis for Processing">
        <P>
          Where the EU/UK General Data Protection Regulation (GDPR) applies, we rely on the following lawful
          bases for processing your personal data:
        </P>
        <UL>
          <li>
            <strong>Contract performance</strong> (Art. 6(1)(b)) — Processing your account information and
            inventory data is necessary to provide the Service you signed up for.
          </li>
          <li>
            <strong>Legitimate interests</strong> (Art. 6(1)(f)) — We process technical data (IP addresses,
            user agents) and aggregated usage data for security, fraud prevention, rate limiting, and service
            improvement. Our legitimate interest is maintaining a secure and reliable service.
          </li>
          <li>
            <strong>Consent</strong> (Art. 6(1)(a)) — AI features that send your data to third-party
            providers are activated only when you explicitly configure and use them. You may withdraw consent
            at any time by disabling AI features or removing your API key from settings.
          </li>
          <li>
            <strong>Legal obligation</strong> (Art. 6(1)(c)) — We may process data to comply with applicable
            legal requirements, such as responding to lawful requests from public authorities.
          </li>
        </UL>
      </Section>

      <Section title="5. Data Storage & Security">
        <P>
          Your data is stored in a SQLite database on our servers. We implement the following security measures:
        </P>
        <UL>
          <li>
            <strong>Authentication</strong> — JWT tokens delivered via httpOnly, secure cookies. Passwords hashed
            with bcrypt.
          </li>
          <li>
            <strong>Encryption in transit</strong> — All connections to the cloud service use HTTPS/TLS.
          </li>
          <li>
            <strong>API key encryption</strong> — AI provider API keys you store in the Service are encrypted at rest
            using AES-256-GCM when an encryption key is configured.
          </li>
          <li>
            <strong>Rate limiting</strong> — Authentication endpoints are rate-limited to prevent brute-force attacks.
          </li>
          <li>
            <strong>Access control</strong> — Role-based permissions (admin, member, viewer) restrict who can read
            and modify data within each location.
          </li>
          <li>
            <strong>Backups</strong> — Automated backups of the database and uploaded photos are stored as
            encrypted archives with restricted file permissions. Backup files are retained according to a
            configured retention policy and are automatically pruned when the retention limit is exceeded.
          </li>
        </UL>
      </Section>

      <Section title="6. AI Features & Third-Party Providers">
        <P>
          The Service offers optional AI-powered features for photo recognition and content suggestions.
          When you use these features:
        </P>
        <UL>
          <li>
            Relevant data (bin names, items, photos) is sent to the AI provider you configure
            (OpenAI, Anthropic, Google Gemini, or a custom OpenAI-compatible endpoint).
          </li>
          <li>
            Your AI provider API key is stored encrypted on our servers and is only used to authenticate requests
            on your behalf.
          </li>
          <li>Data sent to AI providers is subject to those providers' privacy policies and data handling practices.</li>
          <li>AI features are entirely optional — the core Service works without them.</li>
          <li>
            AI feature usage counts (e.g., number of requests per billing period) are tracked per account
            to enforce plan limits. These counts reset monthly and are not shared with third parties.
          </li>
        </UL>
        <P>
          For self-hosted deployments, AI requests go directly from your server to the provider — our cloud
          infrastructure is not involved.
        </P>
      </Section>

      <Section title="7. Photos">
        <P>
          Photos you upload are stored on the server filesystem and served via authenticated API endpoints.
          Photos are only accessible to members of the location where the bin resides. Thumbnails are
          generated and cached server-side for performance. When a bin or account is deleted, associated
          photo files are permanently removed from storage.
        </P>
      </Section>

      <Section title="8. Shared Links">
        <P>
          Location admins can generate a share link for any non-private bin. When someone opens a share
          link, the following data is accessible <strong>without authentication</strong>:
        </P>
        <UL>
          <li>Bin name, items (names and quantities), notes, tags, icon, color, and card style.</li>
          <li>Custom field values attached to the bin.</li>
          <li>Photos and thumbnails associated with the bin, served directly via the share token.</li>
          <li>Area name (if the bin is assigned to one).</li>
        </UL>
        <P>
          Each time a share link is viewed, we increment a view count on the share record. This count
          is visible to the bin owner but is not exposed to the viewer.
        </P>
        <P>
          Share links can be set to expire at a specific date and can be revoked by a location admin at
          any time, immediately cutting off public access. Shared responses include{' '}
          <code className="text-[13px]">X-Robots-Tag: noindex, nofollow</code> and{' '}
          <code className="text-[13px]">Referrer-Policy: no-referrer</code> headers to discourage
          search-engine indexing and referrer leakage.
        </P>
      </Section>

      <Section title="9. Cookies & Local Storage">
        <P>The Service uses the following client-side storage:</P>
        <UL>
          <li>
            <strong>Authentication cookies</strong> — Two httpOnly, secure cookies: a short-lived session token
            (expires after 15 minutes) and a longer-lived refresh token (expires after 7 days, used only to
            renew your session). Both are essential for the Service to function. No personal data is stored in
            these cookies beyond what is needed to verify your identity.
          </li>
          <li>
            <strong>Local storage</strong> — Stores your theme preference, active location, label format settings,
            and UI state. This data never leaves your browser.
          </li>
        </UL>
        <P>
          We do not use third-party tracking cookies or analytics scripts on the cloud service. All cookies
          set by the Service are strictly necessary for authentication and are exempt from consent requirements
          under Article 5(3) of the ePrivacy Directive (2002/58/EC).
        </P>
      </Section>

      <Section title="10. Data Sharing">
        <P>We share your data only in the following circumstances:</P>
        <UL>
          <li>
            <strong>With your location members</strong> — Other users in your locations can see shared bin data
            based on their role and visibility settings.
          </li>
          <li>
            <strong>Via share links</strong> — When a location admin generates a share link for a bin,
            anyone who possesses that link can view the bin's contents without logging in (see Section 8).
          </li>
          <li>
            <strong>With AI providers</strong> — Only when you explicitly use AI features, and only the data
            necessary for the specific AI request.
          </li>
          <li>
            <strong>With our email delivery provider</strong> — We use Resend to send transactional emails
            (password resets, account notifications, and invitation links). Your email address and message
            content are shared with Resend solely for delivery purposes. Resend's privacy policy is available
            at{' '}
            <a href="https://resend.com/legal/privacy-policy" className="text-[var(--accent)] hover:underline">
              resend.com/legal/privacy-policy
            </a>. This does not apply to self-hosted deployments where you configure your own email transport.
          </li>
          <li>
            <strong>Legal obligations</strong> — If required by law, subpoena, or legal process.
          </li>
          <li>
            <strong>Business transfers</strong> — In connection with a merger, acquisition, or sale of assets,
            with notice to affected users.
          </li>
        </UL>
        <P>We do not sell, rent, or trade your personal information to any third party.</P>
      </Section>

      <Section title="11. Data Retention">
        <UL>
          <li>
            <strong>Active data</strong> — Your account and inventory data are retained as long as your account
            is active.
          </li>
          <li>
            <strong>Deleted bins</strong> — Soft-deleted bins are retained in trash for the period configured
            in your location settings (default: 30 days), then permanently removed.
          </li>
          <li>
            <strong>Activity logs</strong> — Retained for the period configured in your location settings
            (default: 90 days), then automatically purged.
          </li>
          <li>
            <strong>Scan history</strong> — Retained to provide you with a persistent record of recently
            scanned bins for quick access. Scan history is capped at your 100 most recent scans per user;
            older entries are automatically replaced. You can clear your entire scan history at any time
            from the QR scanner page, or it is removed when you delete your account.
          </li>
          <li>
            <strong>Account deletion</strong> — When you delete your account, all your personal data, bins,
            photos, and activity logs are permanently removed from the live database and file storage.
          </li>
          <li>
            <strong>Backup retention</strong> — Automated backups created before a deletion may still contain
            your data until those backup files are pruned by the configured retention schedule. Backups are
            automatically deleted on a rolling basis. Data in expired backups is not recoverable once pruned.
          </li>
        </UL>
      </Section>

      <Section title="12. Your Rights">
        <P>Depending on your jurisdiction, you may have the following rights:</P>
        <UL>
          <li>
            <strong>Access</strong> — You can view all your data within the Service at any time.
          </li>
          <li>
            <strong>Export</strong> — You can export all your location data (bins, items, photos, tags, areas)
            in JSON format using the built-in export feature.
          </li>
          <li>
            <strong>Correction</strong> — You can edit your profile, bins, and all other content directly.
          </li>
          <li>
            <strong>Deletion</strong> — You can delete individual bins, clear your scan history, or delete your
            entire account from your profile settings.
          </li>
          <li>
            <strong>Portability</strong> — Exported data is in a standard JSON format that can be imported into
            other systems or a self-hosted {appName} instance. If built-in export is unavailable on your plan,
            you may request a full copy of your personal data by emailing{' '}
            <a href="mailto:privacy@openbin.app" className="text-[var(--accent)] hover:underline">
              privacy@openbin.app
            </a>. We will provide your data in a machine-readable format within 30 days.
          </li>
          <li>
            <strong>Withdraw consent</strong> — Where processing is based on your consent (e.g., AI features),
            you may withdraw consent at any time by disabling those features in your settings. Withdrawal does
            not affect the lawfulness of processing carried out before withdrawal.
          </li>
          <li>
            <strong>Lodge a complaint</strong> — If you believe your data protection rights have been violated,
            you have the right to lodge a complaint with a supervisory authority in the EU/EEA member state of
            your habitual residence, place of work, or place of the alleged infringement. A list of EU data
            protection authorities is available at{' '}
            <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" className="text-[var(--accent)] hover:underline">
              edpb.europa.eu
            </a>.
          </li>
          <li>
            <strong>Restriction & objection</strong> — You may request restriction of processing or object to
            processing based on legitimate interests. Contact us and we will assess your request.
          </li>
        </UL>
        <P>
          To exercise any of these rights or if you have questions, contact us at{' '}
          <a href="mailto:privacy@openbin.app" className="text-[var(--accent)] hover:underline">
            privacy@openbin.app
          </a>.
        </P>
      </Section>

      <Section title="13. Self-Hosted Deployments">
        <P>
          If you run {appName} on your own infrastructure, your data never touches our servers. This Privacy
          Policy applies only to our hosted cloud service. Self-hosted operators are responsible for their own
          data handling practices and should inform their users accordingly.
        </P>
      </Section>

      <Section title="14. Children's Privacy">
        <P>
          The Service is not directed at children under 16. We do not knowingly collect personal information
          from children under 16. For users in the United States, we comply with the Children's Online
          Privacy Protection Act (COPPA) and do not knowingly collect personal information from children
          under 13 without verifiable parental consent. If you believe a child has provided us with personal
          data, please contact us and we will promptly delete it.
        </P>
      </Section>

      <Section title="15. International Data Transfers">
        <P>
          If you access the Service from outside the United States, your data may be transferred to and
          processed in the United States or other countries where our infrastructure or sub-processors
          operate.
        </P>
        <P>
          For transfers of personal data from the EU/EEA or UK to countries that have not received an
          adequacy decision from the European Commission, we rely on the European Commission's Standard
          Contractual Clauses (SCCs) as our primary transfer mechanism, supplemented by additional technical
          and organizational safeguards where appropriate. For transfers to countries with an adequacy
          decision, no additional transfer mechanism is required.
        </P>
        <P>
          You may request a copy of the applicable SCCs by contacting us at{' '}
          <a href="mailto:privacy@openbin.app" className="text-[var(--accent)] hover:underline">
            privacy@openbin.app
          </a>.
        </P>
      </Section>

      <Section title="16. Changes to This Policy">
        <P>
          We may update this Privacy Policy from time to time. Material changes will be communicated via
          email or a prominent notice within the Service at least 30 days before taking effect. The "Effective"
          date at the top of this page indicates when the policy was last revised.
        </P>
      </Section>

      <Section title="17. Contact Us">
        <P>
          If you have questions, concerns, or requests regarding this Privacy Policy or our data practices,
          contact us at:
        </P>
        <UL>
          <li>
            Email:{' '}
            <a href="mailto:privacy@openbin.app" className="text-[var(--accent)] hover:underline">
              privacy@openbin.app
            </a>
          </li>
        </UL>
        <P>
          If you are a business customer who requires a Data Processing Agreement (DPA) for your use of the
          Service, please contact us at the address above and we will provide one for execution.
        </P>
      </Section>
    </LegalPageLayout>
  );
}
