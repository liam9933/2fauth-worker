import { BaseOAuthProvider, OAuthUserInfo } from '@/features/auth/providers/baseOAuthProvider';
import { EnvBindings, AppError } from '@/app/config';

export class GitHubProvider extends BaseOAuthProvider {
    readonly id = 'github';
    readonly name = 'GitHub';
    readonly color = '#24292e';
    readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>';
    readonly whitelistFields = ['email'];

    constructor(env: EnvBindings) {
        super(env);
    }

    getAuthorizeUrl(state: string) {
        const clientId = this.env.OAUTH_GITHUB_CLIENT_ID;
        const redirectUri = this.env.OAUTH_GITHUB_REDIRECT_URI;

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            state: state,
            scope: 'read:user user:email' // 显式请求 Email 权限
        });

        return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
    }

    async handleCallback(params: string | URLSearchParams, _codeVerifier?: string): Promise<OAuthUserInfo> {
        // 兼容处理：如果是 URLSearchParams，提取 code；如果是 string，直接使用
        const code = typeof params === 'string' ? params : params.get('code');

        if (!code) {
            throw new AppError('GitHub OAuth callback missing code', 400);
        }

        // 1. 使用 Code 换取 Access Token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': '2FA-Manager-Backend/1.0'
            },
            body: new URLSearchParams({
                client_id: this.env.OAUTH_GITHUB_CLIENT_ID,
                client_secret: this.env.OAUTH_GITHUB_CLIENT_SECRET,
                code: code,
                redirect_uri: this.env.OAUTH_GITHUB_REDIRECT_URI,
            })
        });

        if (!tokenResponse.ok) {
            throw new AppError(`GitHub Token Exchange failed: ${tokenResponse.status}`, 502);
        }

        const tokenData: any = await tokenResponse.json();

        if (tokenData.error) {
            throw new AppError(`GitHub OAuth Error: ${tokenData.error_description || tokenData.error}`, 400);
        }

        const accessToken = tokenData.access_token;

        // 2. 获取用户信息
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/json',
                'User-Agent': '2FA-Manager-Backend/1.0'
            }
        });

        if (!userResponse.ok) throw new AppError(`GitHub API error: ${userResponse.status}`, 502);
        const userData: any = await userResponse.json();

        // 3. 补充获取 Email (如果公开资料中没有)
        let email = userData.email;
        if (!email) {
            try {
                const emailRes = await fetch('https://api.github.com/user/emails', {
                    headers: { 'Authorization': `token ${accessToken}`, 'User-Agent': '2FA-Manager-Backend/1.0' }
                });
                const emails: any[] = await emailRes.json();
                email = emails.find(e => e.primary && e.verified)?.email || emails.find(e => e.verified)?.email;
            } catch (e) { /* ignore */ }
        }

        // 4. 映射到标准结构
        return {
            id: String(userData.id),
            username: userData.login || userData.username,
            email: email || '',
            avatar: userData.avatar_url,
            provider: this.id
        };
    }
}