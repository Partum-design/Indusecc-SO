-- ============================================================================
-- Indusecc SGC - Esquema de produccion para Supabase
-- Sustituye por completo el esquema anterior del proyecto (otra app).
-- Sin datos de ejemplo. Autenticacion delegada 100% a Supabase Auth.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Limpieza del esquema anterior (proyecto reutilizado)
-- ----------------------------------------------------------------------------
drop table if exists public.nora_conversations cascade;
drop table if exists public.audit_activity_log cascade;
drop table if exists public.audit_signatures cascade;
drop table if exists public.audit_evidence cascade;
drop table if exists public.audit_findings cascade;
drop table if exists public.audits cascade;
drop table if exists public.profiles cascade;
drop type if exists public.user_role cascade;

-- ----------------------------------------------------------------------------
-- 1. Extensiones
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- uuid, cifrado simetrico (pgp_sym_*)
create extension if not exists supabase_vault; -- almacenamiento seguro de llaves/secretos

-- ----------------------------------------------------------------------------
-- 2. Tipos enumerados (contratos cerrados = menos corrupcion de datos)
-- ----------------------------------------------------------------------------
create type public.user_role            as enum ('super_admin','admin','colaborador','consultor');
create type public.registration_status  as enum ('pendiente','aprobada','rechazada');
create type public.action_priority      as enum ('low','medium','high');
create type public.action_status        as enum ('iniciada','en_proceso','cerrada');
create type public.audit_status         as enum ('pendiente','en_progreso','completada');
create type public.finding_severity     as enum ('baja','media','alta','critica');
create type public.finding_status       as enum ('abierto','en_revision','cerrado');
create type public.risk_probability     as enum ('baja','media','alta');
create type public.risk_impact          as enum ('bajo','medio','alto','critico');
create type public.risk_level           as enum ('bajo','medio','alto','critico');
create type public.risk_status          as enum ('activo','en_tratamiento','controlado','cerrado');
create type public.document_status     as enum ('vigente','vencido','archivado');
create type public.training_status     as enum ('pendiente','en_proceso','completado');
create type public.certificate_status  as enum ('activo','expirado','revocado');
create type public.calendar_type       as enum ('auditoria','capacitacion','reunion','otro');
create type public.config_value_type   as enum ('boolean','string','number','object');
create type public.log_status          as enum ('exito','error','advertencia');

-- ----------------------------------------------------------------------------
-- 3. Utilidades comunes
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. profiles (1:1 con auth.users) + registro/aprobacion de cuentas
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null unique,
  name              text not null,
  department        text,
  phone_encrypted   bytea,                          -- telefono cifrado (pgcrypto), nunca en texto plano
  role              public.user_role not null default 'colaborador',
  active            boolean not null default false,  -- las cuentas nuevas entran inactivas hasta aprobacion
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Perfil y rol de cada usuario. Cuentas nuevas quedan inactivas hasta que un admin/super_admin las aprueba.';
comment on column public.profiles.phone_encrypted is 'Telefono cifrado con pgcrypto (pgp_sym_encrypt). Ver funciones encrypt_pii/decrypt_pii_admin.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.registration_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  name             text not null,
  email            text not null,
  phone_encrypted  bytea,
  department       text,
  requested_role   public.user_role not null default 'colaborador',
  status           public.registration_status not null default 'pendiente',
  approval_notes   text,
  approved_by      uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  approved_at      timestamptz,
  rejected_at      timestamptz
);

comment on table public.registration_requests is 'Bitacora de solicitudes de acceso. La cuenta real vive en auth.users/profiles; esta tabla es el rastro de auditoria de aprobacion.';

create index idx_registration_requests_status on public.registration_requests(status);
create index idx_registration_requests_created_at on public.registration_requests(created_at desc);

-- ----------------------------------------------------------------------------
-- 5. Cifrado de PII (telefono, etc.) via Supabase Vault
-- ----------------------------------------------------------------------------
-- La llave se genera una sola vez en el servidor y se guarda cifrada en Vault.
-- Nunca queda expuesta en el codigo ni en este archivo.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pii_encryption_key') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'pii_encryption_key');
  end if;
end $$;

create or replace function public.encrypt_pii(plain text)
returns bytea
language sql
stable
set search_path = public, vault, extensions
as $$
  select case when plain is null or plain = '' then null
    else extensions.pgp_sym_encrypt(plain, (select decrypted_secret from vault.decrypted_secrets where name = 'pii_encryption_key'))
  end;
$$;

create or replace function public.decrypt_pii(cipher bytea)
returns text
language sql
stable
security definer
set search_path = public, vault, extensions
as $$
  select case when cipher is null then null
    else extensions.pgp_sym_decrypt(cipher, (select decrypted_secret from vault.decrypted_secrets where name = 'pii_encryption_key'))
  end;
$$;

revoke all on function public.decrypt_pii(bytea) from public, authenticated, anon;
grant execute on function public.decrypt_pii(bytea) to service_role;

-- Version que solo admin/super_admin pueden invocar desde el cliente (con su propia sesion)
create or replace function public.decrypt_pii_admin(cipher bytea)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_above() then
    raise exception 'No autorizado';
  end if;
  return public.decrypt_pii(cipher);
end;
$$;

grant execute on function public.encrypt_pii(text) to authenticated;
grant execute on function public.decrypt_pii_admin(bytea) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Funciones de rol (security definer para evitar recursion de RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('admin','super_admin') and public.is_active_user();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'super_admin' and public.is_active_user();
$$;

revoke all on function public.current_role() from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin_or_above() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Alta automatica de perfil al registrarse en Supabase Auth
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested public.user_role;
begin
  requested := coalesce((new.raw_user_meta_data->>'requested_role')::public.user_role, 'colaborador');
  if requested not in ('colaborador','consultor') then
    requested := 'colaborador'; -- nadie se autoasigna admin/super_admin
  end if;

  insert into public.profiles (id, email, name, department, phone_encrypted, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'department',
    public.encrypt_pii(new.raw_user_meta_data->>'phone'),
    requested,
    false
  );

  insert into public.registration_requests (user_id, name, email, phone_encrypted, department, requested_role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    public.encrypt_pii(new.raw_user_meta_data->>'phone'),
    new.raw_user_meta_data->>'department',
    requested,
    'pendiente'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Solo ADMIN/SUPER_ADMIN puede aprobar/rechazar, y ADMIN nunca puede tocar cuentas admin/super_admin
create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() = 'admin' then
    if old.role in ('admin','super_admin') or new.role in ('admin','super_admin') then
      raise exception 'Un ADMIN no puede crear ni modificar cuentas ADMIN o SUPER_ADMIN';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_role_change on public.profiles;
create trigger trg_enforce_profile_role_change
  before update of role, active on public.profiles
  for each row execute function public.enforce_profile_role_change();

-- ----------------------------------------------------------------------------
-- 8. RLS: profiles / registration_requests
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.registration_requests enable row level security;

create policy profiles_select_own_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin_or_above());

create policy profiles_update_own_basic on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

create policy registration_requests_select_admin on public.registration_requests
  for select using (public.is_admin_or_above());

create policy registration_requests_update_admin on public.registration_requests
  for update using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- Nadie hace INSERT/DELETE manual: los crea el trigger on_auth_user_created (security definer, bypassa RLS).

-- ----------------------------------------------------------------------------
-- 9. Roles y permisos personalizados (metadatos de UI, no controlan RLS)
-- ----------------------------------------------------------------------------
create table public.custom_roles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  permissions  text[] not null default '{}',
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.custom_roles is 'Catalogo de permisos visibles en el panel de administracion. El control de acceso real (RLS) usa el enum user_role de profiles.';

create trigger trg_custom_roles_updated_at
  before update on public.custom_roles
  for each row execute function public.set_updated_at();

alter table public.custom_roles enable row level security;

create policy custom_roles_select_admin on public.custom_roles
  for select using (public.is_admin_or_above());
create policy custom_roles_write_super_admin on public.custom_roles
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 10. Configuracion global del sistema (solo super_admin)
-- ----------------------------------------------------------------------------
create table public.configurations (
  key         text primary key,
  value       jsonb,
  description text,
  value_type  public.config_value_type not null default 'string',
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

create trigger trg_configurations_updated_at
  before update on public.configurations
  for each row execute function public.set_updated_at();

alter table public.configurations enable row level security;
create policy configurations_super_admin_only on public.configurations
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 11. Auditorias internas ISO
-- ----------------------------------------------------------------------------
create table public.audits (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  date         date not null,
  status       public.audit_status not null default 'pendiente',
  assigned_to  uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_audits_date on public.audits(date desc);
create index idx_audits_status on public.audits(status);

create trigger trg_audits_updated_at
  before update on public.audits
  for each row execute function public.set_updated_at();

alter table public.audits enable row level security;

create policy audits_select on public.audits
  for select using (
    public.is_admin_or_above()
    or public.current_role() = 'consultor'
    or assigned_to = auth.uid()
  );
create policy audits_write_admin on public.audits
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 12. Hallazgos (findings)
-- ----------------------------------------------------------------------------
create table public.findings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  severity          public.finding_severity not null default 'media',
  status            public.finding_status not null default 'abierto',
  reported_by       uuid not null references public.profiles(id),
  assigned_to       uuid references public.profiles(id),
  audit_id          uuid references public.audits(id) on delete set null,
  area              text,
  clause            text,
  risk_level        public.risk_level,
  related_document  text,
  finding_date      date,
  immediate_action  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_findings_audit_status on public.findings(audit_id, status);
create index idx_findings_severity on public.findings(severity);

create trigger trg_findings_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

alter table public.findings enable row level security;

create policy findings_select on public.findings
  for select using (
    public.is_admin_or_above()
    or public.current_role() = 'consultor'
    or reported_by = auth.uid()
    or assigned_to = auth.uid()
  );
create policy findings_insert_self_report on public.findings
  for insert with check (
    public.is_admin_or_above()
    or (public.is_active_user() and reported_by = auth.uid())
  );
create policy findings_update_admin on public.findings
  for update using (public.is_admin_or_above())
  with check (public.is_admin_or_above());
create policy findings_delete_admin on public.findings
  for delete using (public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 13. Riesgos
-- ----------------------------------------------------------------------------
create table public.risks (
  id           uuid primary key default gen_random_uuid(),
  title        text,
  description  text not null,
  process      text not null,
  probability  public.risk_probability not null,
  impact       public.risk_impact not null,
  owner        text not null,
  control      text,
  score        numeric,
  cause        text,
  action       text,
  level        public.risk_level,
  status       public.risk_status not null default 'activo',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_risks_updated_at
  before update on public.risks
  for each row execute function public.set_updated_at();

alter table public.risks enable row level security;

create policy risks_select_active on public.risks
  for select using (public.is_active_user());
create policy risks_write_admin on public.risks
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 14. Acciones / tareas
-- ----------------------------------------------------------------------------
create table public.actions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  area         text,
  assigned_to  uuid references public.profiles(id),
  due_date     date,
  priority     public.action_priority not null default 'medium',
  status       public.action_status not null default 'iniciada',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_actions_updated_at
  before update on public.actions
  for each row execute function public.set_updated_at();

alter table public.actions enable row level security;

create policy actions_select on public.actions
  for select using (
    public.is_admin_or_above()
    or public.current_role() = 'consultor'
    or assigned_to = auth.uid()
  );
create policy actions_write_admin on public.actions
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());
-- El colaborador asignado solo puede cambiar el estado de su propia accion (no titulo/descripcion/fechas)
create policy actions_update_own_status on public.actions
  for update using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());
revoke update on public.actions from authenticated;
grant update (status, updated_at) on public.actions to authenticated;

-- ----------------------------------------------------------------------------
-- 15. Documentos ISO (metadatos; el binario vive en Supabase Storage)
-- ----------------------------------------------------------------------------
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  code           text,
  title          text,
  original_name  text not null,
  storage_path   text not null unique,     -- ruta dentro del bucket 'documents'
  mimetype       text,
  size_bytes     bigint,
  type           text,
  category       text,
  clause         text,
  responsible    text,
  description    text,
  status         public.document_status not null default 'vigente',
  uploaded_by    uuid not null references public.profiles(id),
  expiry_date    date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_documents_code on public.documents(code);
create index idx_documents_status on public.documents(status);
create index idx_documents_uploaded_by on public.documents(uploaded_by);
create index idx_documents_created_at on public.documents(created_at desc);
create index idx_documents_search on public.documents using gin (
  to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(original_name,'') || ' ' || coalesce(code,''))
);

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

create policy documents_select_active on public.documents
  for select using (public.is_active_user());
create policy documents_write_admin on public.documents
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 16. Capacitaciones y certificados
-- ----------------------------------------------------------------------------
create table public.trainings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  module            text not null,
  description       text,
  assigned_to       uuid not null references public.profiles(id),
  status            public.training_status not null default 'pendiente',
  progress          integer not null default 0 check (progress between 0 and 100),
  score             integer check (score between 0 and 100),
  start_date        date,
  completion_date   date,
  scheduled_date    date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_trainings_assigned_status on public.trainings(assigned_to, status);
create index idx_trainings_scheduled on public.trainings(scheduled_date);

create trigger trg_trainings_updated_at
  before update on public.trainings
  for each row execute function public.set_updated_at();

alter table public.trainings enable row level security;

create policy trainings_select on public.trainings
  for select using (
    public.is_admin_or_above()
    or public.current_role() = 'consultor'
    or assigned_to = auth.uid()
  );
create policy trainings_write_admin on public.trainings
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());
create policy trainings_update_own_progress on public.trainings
  for update using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());
revoke update on public.trainings from authenticated;
grant update (progress, status, updated_at) on public.trainings to authenticated;

create table public.certificates (
  id                  uuid primary key default gen_random_uuid(),
  training_id         uuid not null references public.trainings(id) on delete cascade,
  user_id             uuid not null references public.profiles(id),
  title               text not null,
  module              text not null,
  score               integer not null check (score between 0 and 100),
  issue_date          date not null default current_date,
  expiry_date         date,
  certificate_number  text not null unique default ('CERT-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  storage_path        text,          -- PDF en bucket 'certificates', opcional
  status              public.certificate_status not null default 'activo',
  created_at          timestamptz not null default now()
);

create index idx_certificates_user_status on public.certificates(user_id, status);

alter table public.certificates enable row level security;

create policy certificates_select on public.certificates
  for select using (
    public.is_admin_or_above()
    or public.current_role() = 'consultor'
    or user_id = auth.uid()
  );
create policy certificates_write_admin on public.certificates
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 17. Calendario
-- ----------------------------------------------------------------------------
create table public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  date         date not null,
  type         public.calendar_type not null default 'otro',
  assigned_to  uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_calendar_date on public.calendar_events(date);
create index idx_calendar_type on public.calendar_events(type);

create trigger trg_calendar_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

create policy calendar_select_active on public.calendar_events
  for select using (public.is_active_user());
create policy calendar_write_admin on public.calendar_events
  for all using (public.is_admin_or_above())
  with check (public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 18. Bitacora de auditoria del sistema (inmutable)
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  module      text not null,
  description text,
  status      public.log_status not null default 'exito',
  user_id     uuid references public.profiles(id),
  details     jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_action on public.audit_logs(action);
create index idx_audit_logs_module on public.audit_logs(module);
create index idx_audit_logs_status on public.audit_logs(status);

alter table public.audit_logs enable row level security;

-- Solo super_admin puede leer la bitacora completa; nadie puede editarla ni borrarla.
create policy audit_logs_select_super_admin on public.audit_logs
  for select using (public.is_super_admin());

create or replace function public.log_audit_event(
  p_action text, p_module text, p_description text, p_status public.log_status,
  p_details jsonb default null, p_ip inet default null, p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.audit_logs (action, module, description, status, user_id, details, ip_address, user_agent)
  values (p_action, p_module, p_description, p_status, auth.uid(), p_details, p_ip, p_user_agent)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.log_audit_event(text, text, text, public.log_status, jsonb, inet, text) to authenticated, service_role;
-- No hay GRANT de INSERT/UPDATE/DELETE directo a authenticated sobre audit_logs: solo vía esta función.

-- ----------------------------------------------------------------------------
-- 19. Storage: buckets privados + politicas
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760, array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('certificates', 'certificates', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy documents_bucket_read on storage.objects
  for select using (bucket_id = 'documents' and public.is_active_user());
create policy documents_bucket_write_admin on storage.objects
  for all using (bucket_id = 'documents' and public.is_admin_or_above())
  with check (bucket_id = 'documents' and public.is_admin_or_above());

create policy certificates_bucket_read on storage.objects
  for select using (
    bucket_id = 'certificates' and (
      public.is_admin_or_above()
      or public.current_role() = 'consultor'
      or owner = auth.uid()
    )
  );
create policy certificates_bucket_write_admin on storage.objects
  for all using (bucket_id = 'certificates' and public.is_admin_or_above())
  with check (bucket_id = 'certificates' and public.is_admin_or_above());

-- ----------------------------------------------------------------------------
-- 20. Endurecimiento de privilegios sobre funciones (cierra RPC no intencional)
-- ----------------------------------------------------------------------------
-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una funcion: hay que
-- revocarlo explicitamente en funciones sensibles o de uso interno (triggers).
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.enforce_profile_role_change() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

revoke all on function public.decrypt_pii_admin(bytea) from public, anon;
grant execute on function public.decrypt_pii_admin(bytea) to authenticated;

revoke all on function public.log_audit_event(text, text, text, public.log_status, jsonb, inet, text) from public, anon;
grant execute on function public.log_audit_event(text, text, text, public.log_status, jsonb, inet, text) to authenticated, service_role;

revoke all on function public.encrypt_pii(text) from public, anon;
grant execute on function public.encrypt_pii(text) to authenticated;

revoke all on function public.current_role() from public;
revoke all on function public.is_active_user() from public;
revoke all on function public.is_admin_or_above() from public;
revoke all on function public.is_super_admin() from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin_or_above() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 21. Primer SUPER_ADMIN (paso manual, no automatico)
-- ----------------------------------------------------------------------------
-- 1) Crea la cuenta desde Supabase Auth (Dashboard > Authentication > Add user,
--    o supabase.auth.signUp desde el frontend) con el correo real del dueño del sistema.
-- 2) Luego ejecuta, UNA sola vez, sustituyendo el correo:
--
--    update public.profiles
--    set role = 'super_admin', active = true
--    where email = 'correo-del-dueno@dominio.com';
--
-- No se inserta ningún usuario de ejemplo en esta migración.
