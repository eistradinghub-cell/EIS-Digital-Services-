-- EIS Digital Services: Super Admin activity audit log
-- Applied to the linked Supabase project as:
-- admin_audit_log_and_super_admin_reader
-- audit_log_super_admin_read_policy
--
-- Records only operational metadata. It deliberately excludes customer form_data,
-- chat contents, credentials, tokens and website setting values.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid,
    actor_role text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
    ON public.admin_audit_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx
    ON public.admin_audit_logs (entity_type, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Super Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Super Admins can read audit logs"
ON public.admin_audit_logs FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.capture_admin_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_role text;
    v_entity_id uuid;
    v_action text;
    v_summary jsonb := '{}'::jsonb;
BEGIN
    IF v_actor_id IS NOT NULL THEN
        SELECT lower(p.role) INTO v_actor_role
        FROM public.profiles AS p WHERE p.id = v_actor_id;
    ELSE
        v_actor_role := 'system';
    END IF;

    IF TG_TABLE_NAME = 'profiles' THEN
        IF TG_OP <> 'UPDATE' OR OLD.role IS NOT DISTINCT FROM NEW.role THEN RETURN NULL; END IF;
        IF v_actor_role <> 'super_admin' THEN RETURN NULL; END IF;
        v_entity_id := NEW.id;
        v_action := 'administrator_role_changed';
        v_summary := jsonb_build_object('previous_role', OLD.role, 'new_role', NEW.role);

    ELSIF TG_TABLE_NAME = 'applications' THEN
        IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
            IF v_actor_role NOT IN ('admin', 'super_admin') THEN RETURN NULL; END IF;
            v_entity_id := NEW.id;
            v_action := 'application_status_changed';
            v_summary := jsonb_build_object('service', NEW.service_name, 'previous_status', OLD.status, 'new_status', NEW.status);
        ELSIF TG_OP = 'DELETE' AND v_actor_role IN ('admin', 'super_admin') THEN
            v_entity_id := OLD.id;
            v_action := 'application_deleted';
            v_summary := jsonb_build_object('service', OLD.service_name);
        ELSE
            RETURN NULL;
        END IF;

    ELSIF TG_TABLE_NAME = 'payments' THEN
        IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;
        IF v_actor_role NOT IN ('admin', 'super_admin') THEN RETURN NULL; END IF;
        v_entity_id := NEW.id;
        v_action := 'payment_status_changed';
        v_summary := jsonb_build_object('service', NEW.service_name, 'amount', NEW.amount, 'previous_status', OLD.status, 'new_status', NEW.status);

    ELSIF TG_TABLE_NAME = 'services' THEN
        IF v_actor_id IS NOT NULL AND v_actor_role NOT IN ('admin', 'super_admin') THEN RETURN NULL; END IF;
        IF TG_OP = 'INSERT' THEN
            v_entity_id := NEW.id;
            v_action := 'service_created';
            v_summary := jsonb_build_object('service', NEW.name, 'price', NEW.price);
        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.name IS NOT DISTINCT FROM NEW.name AND OLD.price IS NOT DISTINCT FROM NEW.price THEN RETURN NULL; END IF;
            v_entity_id := NEW.id;
            v_action := 'service_updated';
            v_summary := jsonb_build_object('previous_name', OLD.name, 'new_name', NEW.name, 'previous_price', OLD.price, 'new_price', NEW.price);
        ELSIF TG_OP = 'DELETE' THEN
            v_entity_id := OLD.id;
            v_action := 'service_deleted';
            v_summary := jsonb_build_object('service', OLD.name, 'price', OLD.price);
        END IF;

    ELSIF TG_TABLE_NAME = 'site_settings' THEN
        IF v_actor_role <> 'super_admin' THEN RETURN NULL; END IF;
        IF TG_OP = 'DELETE' THEN
            v_action := 'website_setting_deleted';
            v_summary := jsonb_build_object('setting_key', OLD.setting_key);
        ELSIF TG_OP = 'INSERT' THEN
            v_action := 'website_setting_created';
            v_summary := jsonb_build_object('setting_key', NEW.setting_key);
        ELSE
            IF OLD.setting_value IS NOT DISTINCT FROM NEW.setting_value THEN RETURN NULL; END IF;
            v_action := 'website_setting_updated';
            v_summary := jsonb_build_object('setting_key', NEW.setting_key);
        END IF;
    ELSE
        RETURN NULL;
    END IF;

    INSERT INTO public.admin_audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary)
    VALUES (
        v_actor_id,
        coalesce(v_actor_role, 'system'),
        v_action,
        CASE TG_TABLE_NAME
            WHEN 'profiles' THEN 'profiles'
            WHEN 'applications' THEN 'applications'
            WHEN 'payments' THEN 'payments'
            WHEN 'services' THEN 'services'
            WHEN 'site_settings' THEN 'website_settings'
        END,
        v_entity_id,
        v_summary
    );
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_admin_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_profiles_role_changes ON public.profiles;
CREATE TRIGGER audit_profiles_role_changes AFTER UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_event();

DROP TRIGGER IF EXISTS audit_application_changes ON public.applications;
CREATE TRIGGER audit_application_changes AFTER UPDATE OR DELETE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_event();

DROP TRIGGER IF EXISTS audit_payment_status_changes ON public.payments;
CREATE TRIGGER audit_payment_status_changes AFTER UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_event();

DROP TRIGGER IF EXISTS audit_service_changes ON public.services;
CREATE TRIGGER audit_service_changes AFTER INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_event();

DROP TRIGGER IF EXISTS audit_website_setting_changes ON public.site_settings;
CREATE TRIGGER audit_website_setting_changes AFTER INSERT OR UPDATE OR DELETE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_event();

CREATE OR REPLACE FUNCTION public.admin_list_audit_events(
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0,
    p_filter text DEFAULT 'all',
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    id uuid, actor_id uuid, actor_name text, actor_email text, actor_role text,
    action text, entity_type text, entity_id uuid, summary jsonb, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Super Admin access required' USING ERRCODE = '42501';
    END IF;
    IF coalesce(p_filter, 'all') NOT IN ('all', 'security', 'applications', 'payments', 'services', 'settings') THEN
        RAISE EXCEPTION 'Invalid audit filter';
    END IF;
    RETURN QUERY
    SELECT l.id, l.actor_id,
        coalesce(p.full_name, CASE WHEN l.actor_role = 'system' THEN 'System' ELSE 'Administrator' END),
        p.email, l.actor_role, l.action, l.entity_type, l.entity_id, l.summary, l.created_at
    FROM public.admin_audit_logs AS l
    LEFT JOIN public.profiles AS p ON p.id = l.actor_id
    WHERE (
        p_filter = 'all'
        OR (p_filter = 'security' AND l.entity_type = 'profiles')
        OR (p_filter = 'applications' AND l.entity_type = 'applications')
        OR (p_filter = 'payments' AND l.entity_type = 'payments')
        OR (p_filter = 'services' AND l.entity_type = 'services')
        OR (p_filter = 'settings' AND l.entity_type = 'website_settings')
    )
    AND (
        nullif(btrim(p_search), '') IS NULL
        OR l.action ILIKE '%' || btrim(p_search) || '%'
        OR l.entity_type ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.full_name, '') ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.email, '') ILIKE '%' || btrim(p_search) || '%'
        OR l.summary::text ILIKE '%' || btrim(p_search) || '%'
    )
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT least(greatest(coalesce(p_limit, 25), 1), 50)
    OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_audit_events(integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_events(integer, integer, text, text) TO authenticated;
