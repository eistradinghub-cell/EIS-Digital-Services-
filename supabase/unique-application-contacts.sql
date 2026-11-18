-- EIS Digital Services: prevent reuse of primary application email and phone.
-- Run this script in the Supabase SQL Editor for the project's database.
-- Only form_data.email and form_data.phone are unique. Alternative contacts and
-- BVN/account fields are deliberately not included.

-- Preflight query: run this first. Both counts should be zero.
-- SELECT 'email' AS field, count(*) AS duplicate_groups
-- FROM (
--   SELECT lower(btrim(form_data->>'email'))
--   FROM public.applications
--   WHERE nullif(btrim(form_data->>'email'), '') IS NOT NULL
--   GROUP BY lower(btrim(form_data->>'email'))
--   HAVING count(*) > 1
-- ) d
-- UNION ALL
-- SELECT 'phone' AS field, count(*) AS duplicate_groups
-- FROM (
--   SELECT regexp_replace(btrim(form_data->>'phone'), '[^0-9]', '', 'g')
--   FROM public.applications
--   WHERE nullif(regexp_replace(btrim(form_data->>'phone'), '[^0-9]', '', 'g'), '') IS NOT NULL
--   GROUP BY regexp_replace(btrim(form_data->>'phone'), '[^0-9]', '', 'g')
--   HAVING count(*) > 1
-- ) d;

CREATE UNIQUE INDEX IF NOT EXISTS applications_form_data_email_unique_idx
ON public.applications (lower(btrim(form_data->>'email')))
WHERE nullif(btrim(form_data->>'email'), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS applications_form_data_phone_unique_idx
ON public.applications (
  regexp_replace(btrim(form_data->>'phone'), '[^0-9]', '', 'g')
)
WHERE nullif(regexp_replace(btrim(form_data->>'phone'), '[^0-9]', '', 'g'), '') IS NOT NULL;
