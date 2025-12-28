-- Update oauth_states table for secure state validation
-- Drop the old table and recreate with proper structure
DROP TABLE IF EXISTS public.oauth_states CASCADE;

-- Create new oauth_states table
CREATE TABLE public.oauth_states (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT NOW(),
  expires_at timestamp with time zone NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX idx_oauth_states_tenant_id ON public.oauth_states(tenant_id) WHERE tenant_id IS NOT NULL;

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

