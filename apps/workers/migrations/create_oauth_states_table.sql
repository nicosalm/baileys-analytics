-- Create oauth_states table for secure state validation
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT NOW(),
  expires_at timestamp with time zone NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_tenant_id ON public.oauth_states(tenant_id);

-- Grant permissions
GRANT ALL ON public.oauth_states TO service_role;
GRANT SELECT, DELETE ON public.oauth_states TO authenticated;

-- Create a cleanup function for expired states
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.oauth_states 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

