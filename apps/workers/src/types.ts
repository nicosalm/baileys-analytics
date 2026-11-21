import type { User } from '@supabase/supabase-js';

export type AppEnv = {
	Bindings: Env;
	Variables: {
		user: User;
		tenantId: string;
	};
};
