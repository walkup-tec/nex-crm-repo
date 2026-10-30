-- Mantém cobranças apenas de F RODRIGUES CORRETORA DE SEGUROS LTDA (67.141.813/0001-72).
-- Demais invoices/billing_notices eram testes e saem da tela Financeiro.

with live as (
  select id
  from public.organizations
  where regexp_replace(coalesce(document, ''), '\D', '', 'g') = '67141813000172'
),
gone as (
  delete from public.billing_notices bn
  where not exists (select 1 from live l where l.id = bn.organization_id)
  returning bn.id
),
gone_inv as (
  delete from public.invoices i
  where not exists (select 1 from live l where l.id = i.organization_id)
  returning i.id
)
select
  (select count(*) from gone) as billing_notices_removed,
  (select count(*) from gone_inv) as invoices_removed,
  (select count(*) from live) as live_organizations;
