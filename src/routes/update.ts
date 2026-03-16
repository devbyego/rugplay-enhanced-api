import { Env } from '../index';
import { error, success, requireAdmin, sanitize, parseBody } from '../utils';

export async function handleUpdate(request: Request, env: Env, path: string, method: string): Promise<Response> {
    if (path === '/v1/update' && method === 'GET') return getLatestVersion(env);
    if (path === '/v1/update/push' && method === 'POST') return pushVersion(request, env);
    if (path === '/v1/changelog' && method === 'GET') return getChangelog(request, env);
    if (path === '/v1/changelog/push' && method === 'POST') return pushChangelog(request, env);
    if (path === '/v1/changelog/all' && method === 'GET') return getAllChangelogs(env);
    return error(404, 'Update route not found');
}

async function getLatestVersion(env: Env): Promise<Response> {
    const version = await env.KV.get('latest_version');
    if (!version) return success({ version: '1.0.0' });
    return success({ version });
}

async function pushVersion(request: Request, env: Env): Promise<Response> {
    if (!requireAdmin(request, env)) return error(403, 'Unauthorized');
    const body = await parseBody(request);
    if (!body.version) return error(400, 'version is required');
    const clean = sanitize(body.version, 20);
    await env.KV.put('latest_version', clean);
    return success({ message: `Version set to ${clean}` });
}

async function getChangelog(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const version = url.searchParams.get('version');

    if (version) {
        const data = await env.KV.get(`changelog:${sanitize(version, 20)}`);
        if (!data) return error(404, 'Changelog not found for this version');
        return success(JSON.parse(data));
    }

    const latest = await env.KV.get('latest_version');
    if (!latest) return error(404, 'No version found');
    const data = await env.KV.get(`changelog:${latest}`);
    if (!data) return error(404, 'No changelog for latest version');
    return success(JSON.parse(data));
}

async function pushChangelog(request: Request, env: Env): Promise<Response> {
    if (!requireAdmin(request, env)) return error(403, 'Unauthorized');

    const body = await parseBody(request);
    const { version, changes, date } = body;

    if (!version || !Array.isArray(changes) || changes.length === 0) {
        return error(400, 'version and changes[] are required');
    }

    const entry = {
        version: sanitize(version, 20),
        changes: changes.map((c: string) => sanitize(c, 200)).slice(0, 30),
        date: date || new Date().toISOString(),
        pushed_at: Date.now(),
    };

    await env.KV.put(`changelog:${entry.version}`, JSON.stringify(entry));
    await env.DB.prepare(
        'INSERT INTO changelogs (version, changes_json, released_at) VALUES (?, ?, ?) ON CONFLICT(version) DO UPDATE SET changes_json = excluded.changes_json, released_at = excluded.released_at'
    ).bind(entry.version, JSON.stringify(entry.changes), entry.date).run();

    return success({ message: `Changelog pushed for v${entry.version}` });
}

async function getAllChangelogs(env: Env): Promise<Response> {
    const rows = await env.DB.prepare(
        'SELECT version, changes_json, released_at FROM changelogs ORDER BY released_at DESC LIMIT 20'
    ).all();

    const changelogs = (rows.results as any[]).map(row => ({
        version: row.version,
        changes: JSON.parse(row.changes_json),
        date: row.released_at,
    }));

    return success(changelogs);
}
