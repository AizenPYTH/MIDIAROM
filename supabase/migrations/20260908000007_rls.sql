-- =============================================================================
-- 0007 — Row Level Security
-- Principles:
--   * Everything is locked by default.
--   * Customers only ever see rows tied to their own account / orders.
--   * Staff (technician, admin, super admin) can read workshop data.
--   * Catalog & content writes are admin only.
--   * Server code uses the service role for privileged writes AFTER checking
--     permissions in application code; RLS is the safety net, not the only lock.
-- =============================================================================

-- Helper: does the current user own the given order?
create or replace function public.owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.repair_orders o
     where o.id = p_order_id and o.customer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles: read own or staff" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- addresses
alter table public.addresses enable row level security;
create policy "addresses: own read" on public.addresses
  for select to authenticated using (profile_id = auth.uid() or public.is_staff());
create policy "addresses: own insert" on public.addresses
  for insert to authenticated with check (profile_id = auth.uid());
create policy "addresses: own update" on public.addresses
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "addresses: own delete" on public.addresses
  for delete to authenticated using (profile_id = auth.uid());

-- workshops / technicians
alter table public.workshops enable row level security;
create policy "workshops: public read active" on public.workshops
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "workshops: admin write" on public.workshops
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.technicians enable row level security;
create policy "technicians: staff read" on public.technicians
  for select to authenticated using (public.is_staff());
create policy "technicians: admin write" on public.technicians
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Catalog: public read of active rows, admin write
-- ---------------------------------------------------------------------------
alter table public.brands enable row level security;
create policy "brands: public read" on public.brands for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "brands: admin write" on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.console_models enable row level security;
create policy "models: public read" on public.console_models for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "models: admin write" on public.console_models for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.faults enable row level security;
create policy "faults: public read" on public.faults for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "faults: admin write" on public.faults for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.repairs enable row level security;
create policy "repairs: public read" on public.repairs for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "repairs: admin write" on public.repairs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.option_categories enable row level security;
create policy "option_categories: public read" on public.option_categories for select to anon, authenticated using (true);
create policy "option_categories: admin write" on public.option_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.repair_options enable row level security;
create policy "options: public read" on public.repair_options for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "options: admin write" on public.repair_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.repair_option_compatibility enable row level security;
create policy "compat: public read" on public.repair_option_compatibility for select to anon, authenticated using (true);
create policy "compat: admin write" on public.repair_option_compatibility for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.repair_included_options enable row level security;
create policy "included: public read" on public.repair_included_options for select to anon, authenticated using (true);
create policy "included: admin write" on public.repair_included_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.packs enable row level security;
create policy "packs: public read" on public.packs for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "packs: admin write" on public.packs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.pack_items enable row level security;
create policy "pack_items: public read" on public.pack_items for select to anon, authenticated using (true);
create policy "pack_items: admin write" on public.pack_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.shipping_methods enable row level security;
create policy "shipping_methods: public read" on public.shipping_methods for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "shipping_methods: admin write" on public.shipping_methods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.test_checklists enable row level security;
create policy "checklists: staff read" on public.test_checklists for select to authenticated using (public.is_staff());
create policy "checklists: admin write" on public.test_checklists for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.test_checklist_items enable row level security;
create policy "checklist_items: staff read" on public.test_checklist_items for select to authenticated using (public.is_staff());
create policy "checklist_items: admin write" on public.test_checklist_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.packaging_instructions enable row level security;
create policy "packaging: public read" on public.packaging_instructions for select to anon, authenticated
  using (is_active or public.is_staff());
create policy "packaging: admin write" on public.packaging_instructions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
alter table public.repair_orders enable row level security;
create policy "orders: customer read own" on public.repair_orders
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy "orders: staff update" on public.repair_orders
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- Inserts happen server side (service role) after server-side pricing.

alter table public.repair_order_items enable row level security;
create policy "order_items: read own or staff" on public.repair_order_items
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
create policy "order_items: staff write" on public.repair_order_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.order_status_history enable row level security;
create policy "status_history: read own or staff" on public.order_status_history
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());

alter table public.order_events enable row level security;
create policy "events: customer read public own" on public.order_events
  for select to authenticated using ((is_public and public.owns_order(order_id)) or public.is_staff());
create policy "events: staff insert" on public.order_events
  for insert to authenticated with check (public.is_staff());

alter table public.payments enable row level security;
create policy "payments: read own or staff" on public.payments
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
create policy "payments: admin write" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.payment_provider_events enable row level security;
create policy "provider_events: admin read" on public.payment_provider_events
  for select to authenticated using (public.is_admin());

alter table public.invoices enable row level security;
create policy "invoices: read own or staff" on public.invoices
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
create policy "invoices: admin write" on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.shipments enable row level security;
create policy "shipments: read own or staff" on public.shipments
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
create policy "shipments: staff write" on public.shipments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.shipping_events enable row level security;
create policy "shipping_events: read own or staff" on public.shipping_events
  for select to authenticated using (
    public.is_staff() or exists (
      select 1 from public.shipments s where s.id = shipment_id and public.owns_order(s.order_id)
    )
  );
create policy "shipping_events: staff write" on public.shipping_events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Workshop
-- ---------------------------------------------------------------------------
alter table public.order_media enable row level security;
create policy "media: customer read visible own" on public.order_media
  for select to authenticated using ((is_visible_to_customer and public.owns_order(order_id)) or public.is_staff());
create policy "media: customer insert sav own" on public.order_media
  for insert to authenticated with check (
    (kind = 'SAV' and public.owns_order(order_id) and uploaded_by = auth.uid()) or public.is_staff()
  );
create policy "media: staff update" on public.order_media
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "media: staff delete" on public.order_media
  for delete to authenticated using (public.is_staff());

alter table public.reception_reports enable row level security;
create policy "reception: read own or staff" on public.reception_reports
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
create policy "reception: staff write" on public.reception_reports
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Diagnostics are staff-only at table level; customers use the customer_diagnostics view.
alter table public.diagnostics enable row level security;
create policy "diagnostics: staff all" on public.diagnostics
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.supplementary_quotes enable row level security;
create policy "quotes: customer read sent own" on public.supplementary_quotes
  for select to authenticated using ((status <> 'DRAFT' and public.owns_order(order_id)) or public.is_staff());
create policy "quotes: staff write" on public.supplementary_quotes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.supplementary_quote_items enable row level security;
create policy "quote_items: read own or staff" on public.supplementary_quote_items
  for select to authenticated using (
    public.is_staff() or exists (
      select 1 from public.supplementary_quotes q
       where q.id = quote_id and q.status <> 'DRAFT' and public.owns_order(q.order_id)
    )
  );
create policy "quote_items: staff write" on public.supplementary_quote_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.quote_decisions enable row level security;
create policy "quote_decisions: read own or staff" on public.quote_decisions
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
-- Inserts only through decide_supplementary_quote() (security definer).

alter table public.repair_work_logs enable row level security;
create policy "work_logs: staff all" on public.repair_work_logs
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.repair_parts enable row level security;
create policy "parts: staff all" on public.repair_parts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.repair_tests enable row level security;
create policy "tests: read own or staff" on public.repair_tests
  for select to authenticated using (public.owns_order(order_id) or public.is_staff());
create policy "tests: staff write" on public.repair_tests
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.repair_test_results enable row level security;
create policy "test_results: read own or staff" on public.repair_test_results
  for select to authenticated using (
    public.is_staff() or exists (
      select 1 from public.repair_tests t where t.id = repair_test_id and public.owns_order(t.order_id)
    )
  );
create policy "test_results: staff write" on public.repair_test_results
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.order_messages enable row level security;
create policy "messages: customer read own non internal" on public.order_messages
  for select to authenticated using ((not is_internal and public.owns_order(order_id)) or public.is_staff());
create policy "messages: customer insert own" on public.order_messages
  for insert to authenticated with check (
    (public.owns_order(order_id) and author_id = auth.uid() and not is_from_staff and not is_internal)
    or public.is_staff()
  );

-- ---------------------------------------------------------------------------
-- SAV, reviews, notifications
-- ---------------------------------------------------------------------------
alter table public.sav_requests enable row level security;
create policy "sav: read own or staff" on public.sav_requests
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy "sav: customer insert own" on public.sav_requests
  for insert to authenticated with check (customer_id = auth.uid() and public.owns_order(order_id));
create policy "sav: staff update" on public.sav_requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.sav_messages enable row level security;
create policy "sav_messages: read own non internal or staff" on public.sav_messages
  for select to authenticated using (
    public.is_staff() or (
      not is_internal and exists (
        select 1 from public.sav_requests s where s.id = sav_request_id and s.customer_id = auth.uid()
      )
    )
  );
create policy "sav_messages: insert own or staff" on public.sav_messages
  for insert to authenticated with check (
    public.is_staff() or (
      author_id = auth.uid() and not is_from_staff and not is_internal and exists (
        select 1 from public.sav_requests s where s.id = sav_request_id and s.customer_id = auth.uid()
      )
    )
  );

alter table public.reviews enable row level security;
create policy "reviews: read own or staff" on public.reviews
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy "reviews: customer submit own pending" on public.reviews
  for update to authenticated using (customer_id = auth.uid() and status = 'PENDING')
  with check (customer_id = auth.uid() and status = 'PENDING');
create policy "reviews: admin write" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.notifications enable row level security;
create policy "notifications: read own or staff" on public.notifications
  for select to authenticated using (recipient_id = auth.uid() or public.is_staff());
create policy "notifications: mark read own" on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Analytics, audit, settings, content
-- ---------------------------------------------------------------------------
alter table public.analytics_events enable row level security;
create policy "analytics: admin read" on public.analytics_events
  for select to authenticated using (public.is_admin());

alter table public.marketing_costs enable row level security;
create policy "marketing_costs: admin all" on public.marketing_costs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.audit_logs enable row level security;
create policy "audit: admin read" on public.audit_logs
  for select to authenticated using (public.is_admin());

alter table public.site_settings enable row level security;
create policy "settings: public read public keys" on public.site_settings
  for select to anon, authenticated using (is_public or public.is_staff());
create policy "settings: admin write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.content_blocks enable row level security;
create policy "content: public read published" on public.content_blocks
  for select to anon, authenticated using (is_published or public.is_staff());
create policy "content: admin write" on public.content_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.faq_items enable row level security;
create policy "faq: public read active" on public.faq_items
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "faq: admin write" on public.faq_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.seo_pages enable row level security;
create policy "seo: public read" on public.seo_pages for select to anon, authenticated using (true);
create policy "seo: admin write" on public.seo_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.gallery_items enable row level security;
create policy "gallery: public read published" on public.gallery_items
  for select to anon, authenticated using (is_published or public.is_staff());
create policy "gallery: admin write" on public.gallery_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.legal_documents enable row level security;
create policy "legal: public read current" on public.legal_documents
  for select to anon, authenticated using (is_current or public.is_staff());
create policy "legal: admin write" on public.legal_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
