import { Env } from '../index';
import { error, success, parseBody, rateKey } from '../utils';

export async function handleAnalytics(request: Request, env: Env, path: string, method: string): Promise<Response> {
    if (path === '/v1/analytics' && method === 'POST') return trackEvent(request, env);
    if (path === '/v1/analytics/stats' && method === 'GET') return getStats(request, env);
    return error(404, 'Analytics route not found');
}

async function trackEvent(request: Request, env: Env): Promise<Response> {
    const body = await parseBody(request);
    const { event, version } = body;

    const allowed = ['install', 'active_session'];
    if (!event || !allowed.includes(event)) return error(400, 'Invalid event type');

    const rateLimitKey = rateKey(request, `analytics_${event}`);
    const recent = await env.KV.get(rateLimitKey);
    if (recent) return success({ message: 'Already tracked' });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const country = request.cf?.country || 'unknown';
    const day = new Date().toISOString().split('T')[0];

    const countKey = `analytics:${event}:${day}`;
    const current = parseInt(await env.KV.get(countKey) || '0');
    await env.KV.put(countKey, String(current + 1), { expirationTtl: 86400 * 90 });

    const totalKey = `analytics:total:${event}`;
    const total = parseInt(await env.KV.get(totalKey) || '0');
    await env.KV.put(totalKey, String(total + 1));

    const ttl = event === 'install' ? 86400 * 365 : 3600 * 4;
    await env.KV.put(rateLimitKey, '1', { expirationTtl: ttl });

    return success({ message: 'Tracked' });
}

async function getStats(request: Request, env: Env): Promise<Response> {
    const adminSecret = request.headers.get('X-Admin-Secret');
    if (adminSecret !== env.ADMIN_SECRET) return error(403, 'Unauthorized');

    const day = new Date().toISOString().split('T')[0];

    const [installsToday, sessionsToday, totalInstalls, totalSessions] = await Promise.all([
        env.KV.get(`analytics:install:${day}`),
        env.KV.get(`analytics:active_session:${day}`),
        env.KV.get('analytics:total:install'),
        env.KV.get('analytics:total:active_session'),
    ]);

    return success({
        today: {
            installs: parseInt(installsToday || '0'),
            active_sessions: parseInt(sessionsToday || '0'),
        },
        all_time: {
            installs: parseInt(totalInstalls || '0'),
            active_sessions: parseInt(totalSessions || '0'),
        },
    });
}
