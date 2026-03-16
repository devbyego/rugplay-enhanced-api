import { handleReports } from './routes/reports';
import { handleTags } from './routes/tags';
import { handleUpdate } from './routes/update';
import { handleAnalytics } from './routes/analytics';
import { cors, json, error, requireAdmin } from './utils';

export interface Env {
    DB: D1Database;
    KV: KVNamespace;
    ADMIN_SECRET: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === 'OPTIONS') {
            return cors(new Response(null, { status: 204 }));
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            if (path.startsWith('/v1/reports')) return cors(await handleReports(request, env, path, method));
            if (path.startsWith('/v1/tags')) return cors(await handleTags(request, env, path, method));
            if (path.startsWith('/v1/update') || path.startsWith('/v1/changelog')) return cors(await handleUpdate(request, env, path, method));
            if (path.startsWith('/v1/analytics')) return cors(await handleAnalytics(request, env, path, method));
            if (path === '/v1/health') return cors(json({ status: 'ok', version: '1.0.0', timestamp: Date.now() }));

            return cors(error(404, 'Route not found'));
        } catch (e: any) {
            console.error(e);
            return cors(error(500, 'Internal server error'));
        }
    }
};
