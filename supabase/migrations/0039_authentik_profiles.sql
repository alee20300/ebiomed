-- Create an application profile for every new Supabase Auth identity.
-- Authentik/OIDC users start with least-privilege viewer access; local email
-- accounts retain the historical technician default.
CREATE OR REPLACE FUNCTION ebiomed.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO ebiomed.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'preferred_username', ''),
      NEW.email,
      'Authentik user'
    ),
    CASE
      WHEN COALESCE(NEW.raw_app_meta_data ->> 'provider', '') = 'keycloak'
        THEN 'viewer'::ebiomed.user_role
      ELSE 'technician'::ebiomed.user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_ebiomed_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_ebiomed_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION ebiomed.handle_new_auth_user();
