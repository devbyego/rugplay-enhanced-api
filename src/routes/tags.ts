import { Env } from '../index';
import { error, success, requireAdmin, sanitize, parseBody } from '../utils';

export async function handleTags(request: Request, env: Env, path: string, method: string): Promise<Response> {
    if (path === '/v1/tags' && method === 'GET') return getTags(request, env);
    if (path === '/v1/tags/user' && method === 'GET') return getUserTag(request, env);
    if (path === '/v1/tags/set' && method === 'POST') return setTag(request, env);
    if (path === '/v1/tags/remove' && method === 'POST') return removeTag(request, env);
    if (path === '/v1/tags/styles' && method === 'GET') return getTagStyles(env);
    return error(404, 'Tags route not found');
}

async function getTags(request: Request, env: Env): Promise<Response> {
    const cached = await env.KV.get('cache:all_tags');
    if (cached) return success(JSON.parse(cached));

    const rows = await env.DB.prepare('SELECT username, tag, color_bg, color_text, label FROM user_tags ORDER BY username ASC').all();

    const result: Record<string, any> = {};
    for (const row of rows.results as any[]) {
        result[row.username.toLowerCase()] = {
            tag: row.tag,
            label: row.label,
            style: { bg: row.color_bg, text: row.color_text },
        };
    }

    await env.KV.put('cache:all_tags', JSON.stringify(result), { expirationTtl: 300 });
    return success(result);
}

async function getUserTag(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    if (!username) return error(400, 'username is required');

    const row = await env.DB.prepare(
        'SELECT username, tag, color_bg, color_text, label FROM user_tags WHERE username = ?'
    ).bind(username.toLowerCase()).first() as any;

    if (!row) return success(null);

    return success({
        username: row.username,
        tag: row.tag,
        label: row.label,
        style: { bg: row.color_bg, text: row.color_text },
    });
}

async function setTag(request: Request, env: Env): Promise<Response> {
    if (!requireAdmin(request, env)) return error(403, 'Unauthorized');

    const body = await parseBody(request);
    const { username, tag, label, color_bg, color_text } = body;

    if (!username || !tag) return error(400, 'username and tag are required');

    const cleanUsername = sanitize(username, 50).toLowerCase();
    const cleanTag = sanitize(tag, 50).toUpperCase();
    const cleanLabel = sanitize(label || tag, 100);
    const cleanBg = sanitize(color_bg || '#6366f1', 20);
    const cleanText = sanitize(color_text || '#ffffff', 20);

    await env.DB.prepare(
        'INSERT INTO user_tags (username, tag, label, color_bg, color_text, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET tag = excluded.tag, label = excluded.label, color_bg = excluded.color_bg, color_text = excluded.color_text'
    ).bind(cleanUsername, cleanTag, cleanLabel, cleanBg, cleanText, Date.now()).run();

    await env.KV.delete('cache:all_tags');

    return success({ message: `Tag set for ${cleanUsername}` });
}

async function removeTag(request: Request, env: Env): Promise<Response> {
    if (!requireAdmin(request, env)) return error(403, 'Unauthorized');

    const body = await parseBody(request);
    if (!body.username) return error(400, 'username is required');

    await env.DB.prepare('DELETE FROM user_tags WHERE username = ?').bind(body.username.toLowerCase()).run();
    await env.KV.delete('cache:all_tags');

    return success({ message: 'Tag removed' });
}

async function getTagStyles(env: Env): Promise<Response> {
    const styles = {
        DEVELOPER: { bg: '#6366f1', text: '#ffffff', label: 'Developer' },
        VIP: { bg: '#f59e0b', text: '#000000', label: 'VIP' },
        RUGPULLER: { bg: '#ef4444', text: '#ffffff', label: 'Rugpuller' },
        TRUSTED: { bg: '#22c55e', text: '#ffffff', label: 'Trusted' },
        MODERATOR: { bg: '#3b82f6', text: '#ffffff', label: 'Moderator' },
        ENHANCED_USER: { bg: '#8b5cf6', text: '#ffffff', label: 'Enhanced User' },
    };
    return success(styles);
}
