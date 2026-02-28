import { BaseOAuthProvider, OAuthUserInfo } from '@/features/auth/providers/baseOAuthProvider';
import { EnvBindings, AppError } from '@/app/config';

export class GoogleProvider extends BaseOAuthProvider {
    readonly id = 'google';
    readonly name = 'Google';
    readonly color = '#33A854';
    // Google "G" Logo SVG
    readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"/></svg>';
    readonly whitelistFields = ['email']; // Google 主要基于邮箱验证

    constructor(env: EnvBindings) {
        super(env);
    }

    getAuthorizeUrl(state: string) {
        const clientId = this.env.OAUTH_GOOGLE_CLIENT_ID;
        const redirectUri = this.env.OAUTH_GOOGLE_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new AppError('Google OAuth configuration incomplete', 500);
        }

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state: state,
            access_type: 'online',
            prompt: 'consent'
        });

        return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
    }

    async handleCallback(params: string | URLSearchParams, _codeVerifier?: string): Promise<OAuthUserInfo> {
        const code = typeof params === 'string' ? params : params.get('code');

        if (!code) {
            throw new AppError('Google OAuth callback missing code', 400);
        }

        const clientId = this.env.OAUTH_GOOGLE_CLIENT_ID;
        const clientSecret = this.env.OAUTH_GOOGLE_CLIENT_SECRET;
        const redirectUri = this.env.OAUTH_GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            throw new AppError('Google OAuth configuration incomplete', 500);
        }

        // 1. Exchange Code for Token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            })
        });

        if (!tokenResponse.ok) {
             const errText = await tokenResponse.text();
             throw new AppError(`Google Token Exchange failed: ${tokenResponse.status} - ${errText}`, 502);
        }

        const tokenData: any = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Get User Info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!userResponse.ok) throw new AppError(`Google API error: ${userResponse.status}`, 502);
        const userData: any = await userResponse.json();

        return {
            id: userData.sub,
            username: userData.name || userData.email.split('@')[0],
            email: userData.email,
            avatar: userData.picture,
            provider: this.id
        };
    }
}