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
          <li>Username and display name (required).</li>
          <li>Email address (required for cloud accounts; optional for self-hosted).</li>
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

      <Section title="4. Data Storage & Security">
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
        </UL>
      </Section>

      <Section title="5. AI Features & Third-Party Providers">
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
        </UL>
        <P>
          For self-hosted deployments, AI requests go directly from your server to the provider — our cloud
          infrastructure is not involved.
        </P>
      </Section>

      <Section title="6. Photos">
        <P>
          Photos you upload are stored on the server filesystem and served via authenticated API endpoints.
          Photos are only accessible to members of the location where the bin resides. Thumbnails are
          generated and cached server-side for performance. When a bin or account is deleted, associated
          photo files are permanently removed from storage.
        </P>
      </Section>

      <Section title="7. Cookies & Local Storage">
        <P>The Service uses the following client-side storage:</P>
        <UL>
          <li>
            <strong>Authentication cookie</strong> — An httpOnly, secure cookie containing your JWT session token.
            Essential for the Service to function. Expires when the token expires.
          </li>
          <li>
            <strong>Local storage</strong> — Stores your theme preference, active location, label format settings,
            and UI state. This data never leaves your browser.
          </li>
        </UL>
        <P>
          We do not use third-party tracking cookies or analytics scripts on the cloud service.
        </P>
      </Section>

      <Section title="8. Data Sharing">
        <P>We share your data only in the following circumstances:</P>
        <UL>
          <li>
            <strong>With your location members</strong> — Other users in your locations can see shared bin data
            based on their role and visibility settings.
          </li>
          <li>
            <strong>With AI providers</strong> — Only when you explicitly use AI features, and only the data
            necessary for the specific AI request.
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

      <Section title="9. Data Retention">
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
            <strong>Scan history</strong> — Retained until you clear it manually or delete your account.
          </li>
          <li>
            <strong>Account deletion</strong> — When you delete your account, all your personal data, bins,
            photos, and activity logs are permanently removed from our systems.
          </li>
        </UL>
      </Section>

      <Section title="10. Your Rights">
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
            other systems or a self-hosted {appName} instance.
          </li>
        </UL>
        <P>
          To exercise any of these rights or if you have questions, contact us at{' '}
          <a href="mailto:privacy@openbin.app" className="text-[var(--accent)] hover:underline">
            privacy@openbin.app
          </a>.
        </P>
      </Section>

      <Section title="11. Self-Hosted Deployments">
        <P>
          If you run {appName} on your own infrastructure, your data never touches our servers. This Privacy
          Policy applies only to our hosted cloud service. Self-hosted operators are responsible for their own
          data handling practices and should inform their users accordingly.
        </P>
      </Section>

      <Section title="12. Children's Privacy">
        <P>
          The Service is not directed at children under 16. We do not knowingly collect personal information
          from children under 16. If you believe a child has provided us with personal data, please contact us
          and we will promptly delete it.
        </P>
      </Section>

      <Section title="13. International Data Transfers">
        <P>
          If you access the Service from outside the United States, your data may be transferred to and
          processed in the United States. By using the Service, you consent to this transfer. We take
          appropriate safeguards to protect your data in accordance with this policy regardless of where
          it is processed.
        </P>
      </Section>

      <Section title="14. Changes to This Policy">
        <P>
          We may update this Privacy Policy from time to time. Material changes will be communicated via
          email or a prominent notice within the Service at least 30 days before taking effect. The "Effective"
          date at the top of this page indicates when the policy was last revised.
        </P>
      </Section>

      <Section title="15. Contact Us">
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
      </Section>
    </LegalPageLayout>
  );
}
