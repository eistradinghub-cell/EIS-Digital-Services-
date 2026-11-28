-- Keep customer actions unavailable while maintenance mode is enabled.
-- Payment provider webhooks remain available so already completed payments can settle.

create or replace function public.submit_application_with_payment(
  p_payment_reference text,
  p_form_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_payment record;
  v_application_id uuid;
  v_applicant_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.site_runtime_status
    where id = true and maintenance_enabled = true
  ) then
    raise exception 'The website is temporarily under maintenance. Please try again later.';
  end if;

  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' then
    raise exception 'Invalid application form data';
  end if;

  select id, user_id, service_name, amount, status
  into v_payment
  from public.payments
  where reference = p_payment_reference and user_id = v_user_id
  for update;

  if not found then raise exception 'Payment record not found'; end if;
  if v_payment.status <> 'successful' then raise exception 'Payment has not been verified'; end if;

  v_applicant_name := nullif(btrim(concat_ws(' ',
    nullif(btrim(p_form_data->>'agent_first_name'), ''),
    nullif(btrim(p_form_data->>'last_name'), '')
  )), '');

  insert into public.applications (
    user_id, service_name, amount, status, form_data, applicant_name, payment_reference
  ) values (
    v_user_id, v_payment.service_name, v_payment.amount, 'In review',
    p_form_data, v_applicant_name, p_payment_reference
  ) returning id into v_application_id;

  update public.payments set status = 'used'
  where id = v_payment.id and status = 'successful';

  if not found then raise exception 'Payment could not be consumed'; end if;
  return v_application_id;
end;
$function$;

drop policy if exists "Users can insert own conversations" on public.chat_conversations;
create policy "Users can insert own conversations"
on public.chat_conversations for insert to authenticated
with check (
  auth.uid() = customer_id
  and not exists (
    select 1 from public.site_runtime_status
    where id = true and maintenance_enabled = true
  )
);

drop policy if exists "Customers can insert own messages" on public.chat_messages;
create policy "Customers can insert own messages"
on public.chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and sender_role = 'customer'
  and exists (
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and c.customer_id = auth.uid()
  )
  and not exists (
    select 1 from public.site_runtime_status
    where id = true and maintenance_enabled = true
  )
);
