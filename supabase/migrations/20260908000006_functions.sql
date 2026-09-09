-- Sur Supabase (hébergé et CLI), pgcrypto et citext vivent dans le schéma
-- "extensions", hors du search_path par défaut ; sur un PostgreSQL nu ils sont
-- dans "public". Garder les deux évite un échec selon la cible.
set search_path = public, extensions;

-- =============================================================================
-- 0006 — Business RPCs and views
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Customer decision on a supplementary quote.
-- Atomic, authenticated, timestamped. Called through PostgREST RPC by the
-- logged-in customer; ownership is verified inside the function.
-- ---------------------------------------------------------------------------
create or replace function public.decide_supplementary_quote(
  p_quote_id uuid,
  p_decision public.quote_decision,
  p_user_agent text default null,
  p_ip_address text default null
)
returns public.supplementary_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.supplementary_quotes;
  v_order public.repair_orders;
  v_uid uuid := auth.uid();
  v_new_status public.order_status;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_quote from public.supplementary_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  select * into v_order from public.repair_orders where id = v_quote.order_id for update;
  if v_order.customer_id <> v_uid then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_quote.status <> 'SENT' then
    raise exception 'Quote is not awaiting a decision (status %)', v_quote.status using errcode = 'P0001';
  end if;
  if v_quote.expires_at is not null and v_quote.expires_at < now() then
    update public.supplementary_quotes set status = 'EXPIRED' where id = p_quote_id;
    raise exception 'Quote has expired' using errcode = 'P0001';
  end if;

  update public.supplementary_quotes
     set status = case when p_decision = 'ACCEPTED' then 'ACCEPTED'::public.quote_status else 'REFUSED'::public.quote_status end,
         decision = p_decision,
         decided_at = now(),
         decided_by = v_uid
   where id = p_quote_id
   returning * into v_quote;

  insert into public.quote_decisions (quote_id, order_id, decision, decided_by, amount_cents, user_agent, ip_address)
  values (p_quote_id, v_quote.order_id, p_decision, v_uid, v_quote.total_cents, p_user_agent, p_ip_address);

  if p_decision = 'ACCEPTED' then
    -- Add quote lines to the order (source = QUOTE) and update totals.
    insert into public.repair_order_items
      (order_id, item_type, source, reference_id, quote_id, label, description, quantity, unit_price_cents, total_cents, estimated_cost_cents)
    select v_quote.order_id, 'QUOTE_ITEM', 'QUOTE', qi.option_id, qi.quote_id, qi.label, qi.description,
           qi.quantity, qi.unit_price_cents, qi.total_cents, qi.estimated_cost_cents
      from public.supplementary_quote_items qi
     where qi.quote_id = p_quote_id;

    update public.repair_orders
       set subtotal_cents = subtotal_cents + v_quote.total_cents,
           total_cents = total_cents + v_quote.total_cents
     where id = v_quote.order_id;

    -- Payment required -> stay in WAITING_CUSTOMER_APPROVAL until the webhook confirms.
    if v_quote.requires_payment and v_quote.total_cents > 0 then
      v_new_status := 'WAITING_CUSTOMER_APPROVAL';
    else
      v_new_status := 'APPROVED';
    end if;

    insert into public.order_events (order_id, event_type, title, description, actor_id, metadata)
    values (v_quote.order_id, 'QUOTE_ACCEPTED',
            'Devis ' || v_quote.quote_number || ' accepté',
            'Vous avez accepté le devis complémentaire de ' || to_char(v_quote.total_cents / 100.0, 'FM999990.00') || ' €.',
            v_uid, jsonb_build_object('quote_id', p_quote_id, 'amount_cents', v_quote.total_cents));
  else
    if v_quote.is_required_for_repair then
      v_new_status := 'REFUSED_QUOTE';
    else
      v_new_status := 'APPROVED';
    end if;

    insert into public.order_events (order_id, event_type, title, description, actor_id, metadata)
    values (v_quote.order_id, 'QUOTE_REFUSED',
            'Devis ' || v_quote.quote_number || ' refusé',
            'Vous avez refusé le devis complémentaire.',
            v_uid, jsonb_build_object('quote_id', p_quote_id));
  end if;

  -- Only move the order when no other quote is still pending.
  if not exists (
    select 1 from public.supplementary_quotes q
     where q.order_id = v_quote.order_id and q.status = 'SENT' and q.id <> p_quote_id
  ) then
    update public.repair_orders set status = v_new_status where id = v_quote.order_id;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, order_id, new_value, user_agent, ip_address)
  values (v_uid, 'CUSTOMER', 'quote.decided', 'supplementary_quotes', p_quote_id::text, v_quote.order_id,
          jsonb_build_object('decision', p_decision, 'amount_cents', v_quote.total_cents), p_user_agent, p_ip_address);

  return v_quote;
end;
$$;

revoke all on function public.decide_supplementary_quote(uuid, public.quote_decision, text, text) from public;
grant execute on function public.decide_supplementary_quote(uuid, public.quote_decision, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Customer-safe diagnostic view (never exposes internal notes)
-- ---------------------------------------------------------------------------
create view public.customer_diagnostics
with (security_invoker = false)
as
  select d.id, d.order_id, d.declared_fault, d.fault_reproduced, d.outcome, d.severity,
         d.customer_summary, d.recommended_work, d.completed_at, d.created_at, d.updated_at
    from public.diagnostics d
    join public.repair_orders o on o.id = d.order_id
   where d.completed_at is not null
     and (o.customer_id = auth.uid() or public.is_staff());

grant select on public.customer_diagnostics to authenticated;

-- ---------------------------------------------------------------------------
-- Public, moderated reviews (anonymous readable)
-- ---------------------------------------------------------------------------
create view public.public_reviews
with (security_invoker = false)
as
  select r.id, r.rating, r.title, r.body, r.display_name, r.is_featured, r.submitted_at,
         o.model_name, o.repair_name
    from public.reviews r
    join public.repair_orders o on o.id = r.order_id
   where r.status = 'APPROVED' and r.submitted_at is not null;

grant select on public.public_reviews to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profitability per order (staff only through RLS of underlying tables)
-- ---------------------------------------------------------------------------
create view public.order_profitability
with (security_invoker = true)
as
  select o.id as order_id,
         o.order_number,
         o.created_at,
         o.paid_at,
         o.status,
         o.repair_id,
         o.repair_name,
         o.model_id,
         o.model_name,
         o.brand_name,
         o.utm_source,
         o.utm_campaign,
         o.total_cents as revenue_cents,
         o.shipping_cents,
         coalesce((select sum(i.total_cents) from public.repair_order_items i
                    where i.order_id = o.id and i.item_type in ('OPTION','PACK')), 0) as options_revenue_cents,
         coalesce((select sum(i.total_cents) from public.repair_order_items i
                    where i.order_id = o.id and i.item_type = 'QUOTE_ITEM'), 0) as quotes_revenue_cents,
         coalesce((select sum(p.unit_cost_cents * p.quantity) from public.repair_parts p where p.order_id = o.id), 0) as parts_cost_cents,
         coalesce((select sum(s.cost_cents) from public.shipments s where s.order_id = o.id), 0) as shipping_cost_cents,
         coalesce((select sum(w.minutes_spent) from public.repair_work_logs w where w.order_id = o.id), 0) as technician_minutes,
         exists (select 1 from public.sav_requests sv where sv.order_id = o.id) as has_sav
    from public.repair_orders o;

grant select on public.order_profitability to authenticated;
