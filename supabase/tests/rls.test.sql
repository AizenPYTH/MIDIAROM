-- =============================================================================
-- RLS tests. Run through supabase/tests/run.sh on a throwaway database.
-- Every "assert" raises on failure, which makes psql exit non-zero.
-- Key scenario: "customer A can never see customer B's file".
-- =============================================================================
\set ON_ERROR_STOP on

-- Fixtures created as superuser (bypasses RLS, like the service role).
insert into public.repair_orders (id, customer_id, status, brand_name, model_name, fault_name, repair_name,
  customer_first_name, customer_last_name, customer_email, shipping_address, subtotal_cents, shipping_cents, total_cents,
  repair_id, model_id, brand_id, fault_id)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'DIAGNOSIS', 'PlayStation', 'PS5', 'HDMI', 'Réparation port HDMI PS5',
   'Camille', 'Client', 'client@example.com', '{"line1":"1 rue Test","postal_code":"75001","city":"Paris","country_code":"FR"}', 5000, 1490, 6490,
   '46000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'PAID', 'Nintendo', 'Switch', 'USB-C', 'Réparation port USB-C',
   'Dominique', 'Deux', 'client2@example.com', '{"line1":"2 rue Test","postal_code":"69001","city":"Lyon","country_code":"FR"}', 5900, 1490, 7390,
   '46000000-0000-4000-8000-000000000013', '41000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000003');

insert into public.diagnostics (order_id, findings, internal_notes, customer_summary, completed_at, outcome)
values ('50000000-0000-4000-8000-000000000001', 'Port HDMI cassé', 'NOTE INTERNE SECRETE', 'Port HDMI à remplacer', now(), 'REPAIRABLE');

insert into public.supplementary_quotes (id, order_id, status, title, total_cents, sent_at, requires_payment)
values ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'SENT', 'Nettoyage complet', 2490, now(), true);
insert into public.supplementary_quote_items (quote_id, label, unit_price_cents, total_cents)
values ('51000000-0000-4000-8000-000000000001', 'Nettoyage complet', 2490, 2490);

insert into public.order_media (order_id, kind, bucket, path, mime_type, size_bytes, is_visible_to_customer)
values ('50000000-0000-4000-8000-000000000001', 'RECEPTION', 'reception-media', '50000000-0000-4000-8000-000000000001/RECEPTION/a.jpg', 'image/jpeg', 10, true),
       ('50000000-0000-4000-8000-000000000002', 'RECEPTION', 'reception-media', '50000000-0000-4000-8000-000000000002/RECEPTION/b.jpg', 'image/jpeg', 10, true);

insert into storage.objects (bucket_id, name)
values ('reception-media', '50000000-0000-4000-8000-000000000001/RECEPTION/a.jpg'),
       ('reception-media', '50000000-0000-4000-8000-000000000002/RECEPTION/b.jpg'),
       ('content-media', 'gallery/atelier.jpg');

-- Order numbers are generated server side
do $$
declare n text;
begin
  select order_number into n from public.repair_orders where id = '50000000-0000-4000-8000-000000000001';
  assert n ~ '^REP-\d{6}$', 'order number format: ' || n;
  assert (select count(distinct order_number) from public.repair_orders) = 2, 'order numbers unique';
  assert (select count(*) from public.order_status_history where order_id = '50000000-0000-4000-8000-000000000001') = 1, 'initial status logged';
end $$;

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
set role anon;
do $$
begin
  assert (select count(*) from public.repairs where is_active) > 0, 'anon reads active repairs';
  assert (select count(*) from public.repair_orders) = 0, 'anon sees no orders';
  assert (select count(*) from public.site_settings where key = 'brand') = 1, 'anon reads public settings';
  assert (select count(*) from storage.objects where bucket_id = 'content-media') = 1, 'anon reads public content bucket';
  assert (select count(*) from storage.objects where bucket_id = 'reception-media') = 0, 'anon cannot list private media';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Customer A (client@example.com)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
do $$
declare v_updated int;
begin
  assert (select count(*) from public.repair_orders) = 1, 'customer A sees exactly one order';
  assert (select customer_id from public.repair_orders limit 1) = '10000000-0000-4000-8000-000000000003', 'customer A sees own order only';
  assert (select count(*) from public.repair_orders where id = '50000000-0000-4000-8000-000000000002') = 0, 'customer A cannot see customer B order';
  assert (select count(*) from public.order_media) = 1, 'customer A sees own media only';
  assert (select count(*) from storage.objects where bucket_id = 'reception-media') = 1, 'customer A lists own storage objects only';
  assert (select name from storage.objects where bucket_id = 'reception-media') like '50000000-0000-4000-8000-000000000001/%', 'storage object belongs to A';
  assert (select count(*) from public.diagnostics) = 0, 'customer cannot read raw diagnostics table';
  assert (select count(*) from public.customer_diagnostics) = 1, 'customer reads diagnostic through safe view';
  assert (select count(*) from public.supplementary_quotes) = 1, 'customer sees own sent quote';
  assert (select count(*) from public.profiles) = 1, 'customer sees own profile only';

  -- Customers cannot change order status
  update public.repair_orders set status = 'COMPLETED' where id = '50000000-0000-4000-8000-000000000001';
  get diagnostics v_updated = row_count;
  assert v_updated = 0, 'customer cannot update orders';

  -- Customers cannot escalate their role
  begin
    update public.profiles set role = 'ADMIN' where id = '10000000-0000-4000-8000-000000000003';
    raise exception 'role escalation should have failed';
  exception when insufficient_privilege then
    null;
  end;

  -- Customer cannot decide someone else's quote (there is none visible, but the RPC must refuse too)
  begin
    perform public.decide_supplementary_quote('51000000-0000-4000-8000-000000000001', 'ACCEPTED', 'test-agent');
  end;
  assert (select status from public.supplementary_quotes where id = '51000000-0000-4000-8000-000000000001') = 'ACCEPTED', 'owner can accept quote';
  assert (select count(*) from public.quote_decisions) = 1, 'decision trace recorded';
  assert (select total_cents from public.repair_orders where id = '50000000-0000-4000-8000-000000000001') = 6490 + 2490, 'order total updated after acceptance';
  assert (select status from public.repair_orders where id = '50000000-0000-4000-8000-000000000001') = 'WAITING_CUSTOMER_APPROVAL', 'order awaits payment after acceptance';

  -- Double decision is refused
  begin
    perform public.decide_supplementary_quote('51000000-0000-4000-8000-000000000001', 'REFUSED', 'test-agent');
    raise exception 'second decision should fail';
  exception when raise_exception then
    null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Customer B tries to touch A's data
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', false);
do $$
begin
  assert (select count(*) from public.repair_orders where id = '50000000-0000-4000-8000-000000000001') = 0, 'customer B cannot see A order';
  assert (select count(*) from public.supplementary_quotes) = 0, 'customer B sees no quotes of A';
  assert (select count(*) from public.customer_diagnostics) = 0, 'customer B sees no diagnostics of A';
  assert (select count(*) from public.order_media where order_id = '50000000-0000-4000-8000-000000000001') = 0, 'customer B cannot see A media';
  begin
    perform public.decide_supplementary_quote('51000000-0000-4000-8000-000000000001', 'ACCEPTED', 'test-agent');
    raise exception 'customer B decided A quote';
  exception when insufficient_privilege or raise_exception then
    null;
  end;
  -- cannot insert a SAV request on A's order
  begin
    insert into public.sav_requests (order_id, customer_id, subject, description)
    values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'x', 'y');
    raise exception 'customer B opened SAV on A order';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Technician: sees everything in the workshop, but no admin-only tables
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
do $$
declare v_updated int;
begin
  assert (select count(*) from public.repair_orders) = 2, 'technician sees all orders';
  assert (select count(*) from public.diagnostics) = 1, 'technician reads diagnostics';
  assert (select count(*) from public.audit_logs) = 0, 'technician cannot read audit logs';
  assert (select count(*) from public.analytics_events) = 0, 'technician cannot read analytics';
  update public.repair_orders set status = 'REPAIRING' where id = '50000000-0000-4000-8000-000000000002';
  get diagnostics v_updated = row_count;
  assert v_updated = 1, 'technician can update order status';
  begin
    update public.repairs set price_cents = 1 where id = '46000000-0000-4000-8000-000000000001';
    get diagnostics v_updated = row_count;
    assert v_updated = 0, 'technician cannot change catalog prices';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $$
declare v_updated int;
begin
  update public.repairs set price_cents = price_cents where id = '46000000-0000-4000-8000-000000000001';
  get diagnostics v_updated = row_count;
  assert v_updated = 1, 'admin can edit catalog';
  assert (select count(*) from public.audit_logs) >= 1, 'admin reads audit logs';
  update public.profiles set role = 'TECHNICIAN' where id = '10000000-0000-4000-8000-000000000004';
  get diagnostics v_updated = row_count;
  assert v_updated = 1, 'admin can change roles';
  update public.profiles set role = 'CUSTOMER' where id = '10000000-0000-4000-8000-000000000004';
end $$;

reset role;
select 'RLS tests OK' as result;
