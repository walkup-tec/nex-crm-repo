# Banco

O esquema está no Supabase do projeto, não em um Postgres avulso. As migrações usam `auth.uid()`, os papéis `authenticated` e `service_role`, e o storage do Supabase.

## Migrações

- `drizzle/migrations/0000_create_nex_ads_core.sql`
- `drizzle/migrations/0001_secure_nex_creatives_storage.sql`

## Tabelas

- `organizations`, `profiles`, `user_roles`, `user_permissions`
- `meta_accounts`, `campaigns`
- `contracts`, `invoices`
- `creative_folders`, `creative_files`
- `alert_events`, `audit_logs`

## Storage

Bucket privado `nex-creatives`. O caminho começa pelo id da organização. Políticas em `storage.objects`.
