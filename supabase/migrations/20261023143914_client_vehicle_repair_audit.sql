-- Arquivo administrativo para preservar os registros anteriores a reparos autorizados.
-- Sem RPC, sem acesso para clientes/oficinas e sem dados de produção no repositório.
create table private.client_vehicle_repair_audit (
  repair_key text primary key,
  repaired_at timestamptz not null default now(),
  reason text not null,
  mapping jsonb not null,
  before_data jsonb not null,
  after_data jsonb not null
);
alter table private.client_vehicle_repair_audit enable row level security;
revoke all on private.client_vehicle_repair_audit from public,anon,authenticated;
