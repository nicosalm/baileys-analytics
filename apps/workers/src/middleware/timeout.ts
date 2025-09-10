import { Context, Next } from 'hono';

interface TimeoutOptions {
	ms?: number;
	message?: string;
}

export function timeout(options: TimeoutOptions = {}) {
	const { 
		ms = 30000,  // 30 seconds default
		message = 'Request timeout' 
	} = options;
	
	return async function timeoutMiddleware(c: Context, next: Next) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), ms);
		
		try {
			await Promise.race([
				next(),
				new Promise((_, reject) => {
					controller.signal.addEventListener('abort', () => {
						reject(new Error(message));
					});
				})
			]);
		} catch (error) {
			if (error instanceof Error && error.message === message) {
				return c.json({ error: message }, 504);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	};
}

