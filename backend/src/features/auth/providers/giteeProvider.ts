import { BaseOAuthProvider, OAuthUserInfo } from '@/features/auth/providers/baseOAuthProvider';
import { EnvBindings, AppError } from '@/app/config';

export class GiteeProvider extends BaseOAuthProvider {
    readonly id = 'gitee';
    readonly name = 'Gitee';
    readonly color = '#c71d23';
    readonly icon = '<svg width="1em" height="1em" viewBox="0 0 90 90" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><circle id="Combined-Shape" fill="#C71D23" cx="44.8544363" cy="44.8544363" r="44.8544363"></circle><path d="M67.558546,39.8714292 L42.0857966,39.8714292 C40.8627004,39.8720094 39.8710953,40.8633548 39.8701949,42.0864508 L39.8687448,47.623783 C39.867826,48.8471055 40.8592652,49.8390642 42.0825879,49.8393845 C42.0827874,49.8393846 42.0829869,49.8393846 42.0831864,49.8387862 L57.5909484,49.838657 C58.8142711,49.8386283 59.8059783,50.830319 59.8059885,52.0536417 C59.8059885,52.0536479 59.8059885,52.053654 59.8059701,52.0536602 L59.8059701,52.6073539 L59.8059701,52.6073539 L59.8059701,53.161115 C59.8059701,56.8310831 56.8308731,59.80618 53.160905,59.80618 L32.1165505,59.80618 C30.8934034,59.806119 29.9018373,58.8145802 29.9017425,57.5914331 L29.9011625,36.5491188 C29.9008781,32.8791508 32.8758931,29.9039718 36.5458611,29.9038706 C36.5459222,29.9038706 36.5459833,29.9038706 36.5460443,29.9040538 L67.5523638,29.9040538 C68.77515,29.9026795 69.7666266,28.9118177 69.7687593,27.6890325 L69.7721938,22.1516997 C69.774326,20.928378 68.7832423,19.9360642 67.5599198,19.9353054 C67.5594619,19.9353054 67.5590039,19.9353054 67.558546,19.9366784 L36.5479677,19.9366784 C27.3730474,19.9366784 19.935305,27.3744208 19.935305,36.549341 L19.935305,67.558546 C19.935305,68.7818687 20.927004,69.7735676 22.1503267,69.7735676 L54.8224984,69.7735676 C63.079746,69.7735676 69.7735676,63.079746 69.7735676,54.8224984 L69.7735676,42.0864509 C69.7735676,40.8631282 68.7818687,39.8714292 67.558546,39.8714292 Z" id="G" fill="#FFFFFF"></path></svg>';
    readonly whitelistFields = ['email'];

    constructor(env: EnvBindings) {
        super(env);
    }

    getAuthorizeUrl(state: string) {
        const clientId = this.env.OAUTH_GITEE_CLIENT_ID;
        const redirectUri = this.env.OAUTH_GITEE_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new AppError('Gitee OAuth configuration incomplete', 500);
        }

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'user_info emails',
            state: state
        });

        return { url: `https://gitee.com/oauth/authorize?${params.toString()}` };
    }

    async handleCallback(params: string | URLSearchParams, _codeVerifier?: string): Promise<OAuthUserInfo> {
        // 兼容处理：如果是 URLSearchParams，提取 code；如果是 string，直接使用
        const code = typeof params === 'string' ? params : params.get('code');

        if (!code) {
            throw new AppError('Gitee OAuth callback missing code', 400);
        }

        const clientId = this.env.OAUTH_GITEE_CLIENT_ID;
        const clientSecret = this.env.OAUTH_GITEE_CLIENT_SECRET;
        const redirectUri = this.env.OAUTH_GITEE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            throw new AppError('Gitee OAuth configuration incomplete', 500);
        }

        // 1. Exchange Code for Token
        const tokenResponse = await fetch('https://gitee.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
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
            throw new AppError(`Gitee Token Exchange failed: ${tokenResponse.status}`, 502);
        }

        const tokenData: any = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Get User Info
        const userResponse = await fetch(`https://gitee.com/api/v5/user?access_token=${accessToken}`);
        if (!userResponse.ok) throw new AppError(`Gitee API error: ${userResponse.status}`, 502);
        const userData: any = await userResponse.json();

        // 3. Get Email (if not in basic profile)
        let email = userData.email;
        if (!email) {
            try {
                const emailRes = await fetch(`https://gitee.com/api/v5/emails?access_token=${accessToken}`);
                if (emailRes.ok) {
                    const emails: any[] = await emailRes.json();
                    email = emails.find(e => e.scope && e.scope.includes('primary'))?.email || emails[0]?.email;
                }
            } catch (e) { /* ignore */ }
        }

        return {
            id: String(userData.id),
            username: userData.login || userData.name,
            email: email || '',
            avatar: userData.avatar_url || '',
            provider: this.id
        };
    }
}