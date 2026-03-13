const gmailScopes = ['https://www.googleapis.com/auth/gmail.readonly'];
const googleLoginScopes = ['openid', 'email', 'profile'];

const getBaseUrl = (): string => process.env.APP_BASE_URL ?? 'http://localhost:3027';

export const getGoogleOAuthConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? `${getBaseUrl()}/api/oauth/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
};

type BuildGoogleOAuthUrlOptions = {
  scopes?: string[];
  accessType?: 'offline' | 'online';
  prompt?: string;
};

export const buildGoogleOAuthUrl = (
  state: string,
  options?: BuildGoogleOAuthUrlOptions,
): string => {
  const { clientId, redirectUri } = getGoogleOAuthConfig();

  if (!clientId) {
    throw new Error('Missing GOOGLE_CLIENT_ID.');
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', (options?.scopes ?? gmailScopes).join(' '));
  url.searchParams.set('access_type', options?.accessType ?? 'offline');
  url.searchParams.set('prompt', options?.prompt ?? 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);

  return url.toString();
};

export const buildGoogleLoginOAuthUrl = (state: string): string =>
  buildGoogleOAuthUrl(state, {
    scopes: googleLoginScopes,
    accessType: 'online',
    prompt: 'select_account',
  });

export const getGoogleScopes = (): string[] => [...gmailScopes];
export const getGoogleLoginScopes = (): string[] => [...googleLoginScopes];

export const hasGoogleOAuthConfig = (): boolean => {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return Boolean(clientId && clientSecret && redirectUri);
};
