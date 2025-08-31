import { SupabaseClient } from '@supabase/supabase-js';

export class AuthService {
	constructor(private supabase: SupabaseClient) {}

	async login(email: string, password: string) {
		const { data, error } = await this.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			return { error: error.message };
		}

		return {
			accessToken: data.session?.access_token,
			refreshToken: data.session?.refresh_token,
			user: data.user
		};
	}

	async verifyToken(token: string) {
		const { data, error } = await this.supabase.auth.getUser(token);
		
		if (error) {
			return null;
		}

		return data.user;
	}

	async refreshAccessToken(refreshToken: string) {
		const { data, error } = await this.supabase.auth.refreshSession({
			refresh_token: refreshToken
		});

		if (error) {
			return null;
		}

		return data.session?.access_token;
	}
}