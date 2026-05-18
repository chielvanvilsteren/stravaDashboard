-- 003_push_subscriptions.sql
-- Tabel voor Web Push subscriptions (single-user: maximaal één rij, id = 1)

create table if not exists push_subscriptions (
  id            int primary key default 1,
  subscription  jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Zorg dat er nooit meer dan één rij is
create unique index if not exists push_subscriptions_single_row
  on push_subscriptions ((id = 1)) where id = 1;
