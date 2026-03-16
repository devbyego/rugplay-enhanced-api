export function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function error(status: number, message: string): Response {
    return json({ status: 'error', message }, status);
}

export function success(data: unknown): Response {
    return json({ status: 'success', data });
}

export function cors(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', 'https://rugplay.com');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
    return new Response(response.body, { status: response.status, headers });
}

export function requireAdmin(request: Request, env: { ADMIN_SECRET: string }): boolean {
    return request.headers.get('X-Admin-Secret') === env.ADMIN_SECRET;
}

export function paginate(page: number, limit: number) {
    const p = Math.max(1, page);
    const l = Math.min(50, Math.max(1, limit));
    return { offset: (p - 1) * l, limit: l, page: p };
}

export function sanitize(str: string, max = 500): string {
    return String(str ?? '').trim().slice(0, max).replace(/[<>]/g, '');
}

export async function parseBody(request: Request): Promise<Record<string, any>> {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

export function rateKey(request: Request, action: string): string {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    return `rate:${action}:${ip}`;
}
