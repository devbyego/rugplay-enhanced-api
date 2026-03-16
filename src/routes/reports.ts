import { Env } from '../index';
import { json, error, success, requireAdmin, paginate, sanitize, parseBody, rateKey } from '../utils';

export async function handleReports(request: Request, env: Env, path: string, method: string): Promise<Response> {
    if (path === '/v1/reports' && method === 'GET') return getReports(request, env);
    if (path === '/v1/reports/submit' && method === 'POST') return submitReport(request, env);
    if (path === '/v1/reports/vote' && method === 'POST') return voteReport(request, env);
    if (path === '/v1/reports/delete' && method === 'POST') return deleteReport(request, env);
    return error(404, 'Reports route not found');
}

async function getReports(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { offset, limit, page } = paginate(
        parseInt(url.searchParams.get('page') || '1'),
        parseInt(url.searchParams.get('limit') || '10')
    );

    const symbol = url.searchParams.get('symbol')?.toUpperCase();
    const username = url.searchParams.get('username');

    let query = 'SELECT * FROM reports WHERE status = ? ';
    let countQuery = 'SELECT COUNT(*) as total FROM reports WHERE status = ? ';
    const params: any[] = ['approved'];
    const countParams: any[] = ['approved'];

    if (symbol) {
        query += 'AND coin_symbol = ? ';
        countQuery += 'AND coin_symbol = ? ';
        params.push(symbol);
        countParams.push(symbol);
    }

    if (username) {
        query += 'AND reported_username = ? ';
        countQuery += 'AND reported_username = ? ';
        params.push(username);
        countParams.push(username);
    }

    query += 'ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows, countRow] = await Promise.all([
        env.DB.prepare(query).bind(...params).all(),
        env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>(),
    ]);

    const total = countRow?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return success({
        reports: rows.results,
        pagination: { page, limit, total, total_pages: totalPages },
    });
}

async function submitReport(request: Request, env: Env): Promise<Response> {
    const body = await parseBody(request);
    const { username, coinSymbol, description, evidence } = body;

    if (!username || !coinSymbol || !description) {
        return error(400, 'username, coinSymbol, and description are required');
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = rateKey(request, 'submit_report');
    const recentSubmit = await env.KV.get(rateLimitKey);
    if (recentSubmit) return error(429, 'You can only submit one report per hour');

    const cleanUsername = sanitize(username, 50);
    const cleanSymbol = sanitize(coinSymbol, 20).toUpperCase();
    const cleanDescription = sanitize(description, 1000);
    const cleanEvidence = sanitize(evidence || '', 500);

    const existing = await env.DB.prepare(
        'SELECT id FROM reports WHERE reported_username = ? AND coin_symbol = ? AND status != ?'
    ).bind(cleanUsername, cleanSymbol, 'rejected').first();

    if (existing) return error(409, 'A report for this user and coin already exists');

    const id = crypto.randomUUID();
    await env.DB.prepare(
        'INSERT INTO reports (id, reported_username, coin_symbol, description, evidence, submitter_ip_hash, status, upvotes, downvotes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)'
    ).bind(id, cleanUsername, cleanSymbol, cleanDescription, cleanEvidence, await hashIP(ip), 'pending', Date.now()).run();

    await env.KV.put(rateLimitKey, '1', { expirationTtl: 3600 });

    return success({ id, message: 'Report submitted and pending review' });
}

async function voteReport(request: Request, env: Env): Promise<Response> {
    const body = await parseBody(request);
    const { id, type } = body;

    if (!id || !['upvote', 'downvote'].includes(type)) {
        return error(400, 'id and type (upvote or downvote) are required');
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const voteKey = `vote:${id}:${await hashIP(ip)}`;
    const alreadyVoted = await env.KV.get(voteKey);
    if (alreadyVoted) return error(429, 'You have already voted on this report');

    const report = await env.DB.prepare('SELECT id FROM reports WHERE id = ? AND status = ?').bind(id, 'approved').first();
    if (!report) return error(404, 'Report not found');

    const column = type === 'upvote' ? 'upvotes' : 'downvotes';
    await env.DB.prepare(`UPDATE reports SET ${column} = ${column} + 1 WHERE id = ?`).bind(id).run();
    await env.KV.put(voteKey, '1', { expirationTtl: 86400 * 30 });

    return success({ message: 'Vote recorded' });
}

async function deleteReport(request: Request, env: Env): Promise<Response> {
    if (!requireAdmin(request, env)) return error(403, 'Unauthorized');
    const body = await parseBody(request);
    if (!body.id) return error(400, 'id is required');
    await env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(body.id).run();
    return success({ message: 'Report deleted' });
}

async function hashIP(ip: string): Promise<string> {
    const encoded = new TextEncoder().encode(ip + 're_salt_2024');
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
