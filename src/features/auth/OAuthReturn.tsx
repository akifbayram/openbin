import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';

const ERROR_MESSAGES: Record<string, string> = {
  provider_denied: 'Sign-in was cancelled',
  token_exchange_failed: 'Authentication failed — please try again',
  email_not_verified: 'Your email must be verified with the provider',
  nonce_mismatch: 'Authentication failed — please try again',
  callback_failed: 'Authentication failed — please try again',
  no_email: 'An email address is required to sign in',
  invalid_flow: 'Invalid authentication flow',
};

export function useOAuthReturn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (!oauth) return;

    if (oauth === 'success') {
      refreshSession();
    } else if (oauth === 'error') {
      const reason = searchParams.get('reason') || 'callback_failed';
      showToast({
        message: ERROR_MESSAGES[reason] || 'Authentication failed',
        variant: 'error',
      });
    }

    setSearchParams((prev) => {
      prev.delete('oauth');
      prev.delete('reason');
      return prev;
    }, { replace: true });
  }, []);
}
