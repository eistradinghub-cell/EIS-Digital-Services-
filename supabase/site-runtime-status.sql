-- Runtime maintenance status used by Cloudflare Pages middleware.
-- Safe public read; only Super Admin can change the setting.
create table if not exists public.site_runtime_status (
    id boolean primary key default true check (id is true),
    maintenance_enabled boolean not null default false,
    maintenance_message text not null default 'We are carrying out scheduled maintenance. Please check back shortly.',
    expected_return_at timestamptz,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id) on delete set null
);

insert into public.site_runtime_status (id)
values (true)
on conflict (id) do nothing;

alter table public.site_runtime_status enable row level security;
grant select on public.site_runtime_status to anon, authenticated;
grant update on public.site_runtime_status to authenticated;

drop policy if exists "Public can read site runtime status" on public.site_runtime_status;
create policy "Public can read site runtime status"
on public.site_runtime_status for select to anon, authenticated using (true);

drop policy if exists "Super admins can update site runtime status" on public.site_runtime_status;
create policy "Super admins can update site runtime status"
on public.site_runtime_status for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

revoke insert, delete, truncate on public.site_runtime_status from anon, authenticated;
