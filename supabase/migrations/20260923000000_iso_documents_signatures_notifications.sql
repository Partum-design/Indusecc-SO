-- ============================================================================
-- Indusecc SGC - Catalogo ISO 9001:2015, firmas electronicas y notificaciones
-- Idempotente: se puede ejecutar mas de una vez sin efectos secundarios.
-- Requiere que 20260703000000_init_schema.sql ya este aplicada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catalogo ISO 9001:2015 (clausulas 4 a 10, hasta nivel x.y.z.w)
-- ----------------------------------------------------------------------------
create table if not exists public.iso_clauses (
  code         text primary key,
  parent_code  text references public.iso_clauses(code) on delete cascade,
  level        smallint not null check (level between 1 and 4),
  title        text not null,
  description  text,
  sort_order   integer not null
);

comment on table public.iso_clauses is 'Estructura oficial de la norma ISO 9001:2015. El cumplimiento se calcula en el backend a partir de los documentos vinculados a cada clausula.';

create index if not exists idx_iso_clauses_parent on public.iso_clauses(parent_code);

alter table public.iso_clauses enable row level security;
drop policy if exists iso_clauses_select_authenticated on public.iso_clauses;
create policy iso_clauses_select_authenticated on public.iso_clauses
  for select to authenticated using (true);

insert into public.iso_clauses (code, parent_code, level, title, description, sort_order) values
  ('4', null, 1, 'Contexto de la organización', 'Comprender la organización, su contexto y el alcance del sistema de gestión de la calidad.', 10),
  ('4.1', '4', 2, 'Comprensión de la organización y de su contexto', 'Cuestiones externas e internas pertinentes para el propósito y la dirección estratégica del SGC.', 20),
  ('4.2', '4', 2, 'Comprensión de las necesidades y expectativas de las partes interesadas', 'Identificar las partes interesadas pertinentes y sus requisitos.', 30),
  ('4.3', '4', 2, 'Determinación del alcance del sistema de gestión de la calidad', 'Límites y aplicabilidad del SGC, productos y servicios cubiertos.', 40),
  ('4.4', '4', 2, 'Sistema de gestión de la calidad y sus procesos', 'Establecer, implementar, mantener y mejorar continuamente el SGC y sus procesos.', 50),
  ('4.4.1', '4.4', 3, 'Procesos del SGC y su interacción', 'Entradas, salidas, secuencia, criterios, recursos, responsabilidades, riesgos e indicadores de cada proceso.', 60),
  ('4.4.2', '4.4', 3, 'Información documentada de los procesos', 'Mantener y conservar información documentada que apoye la operación de los procesos.', 70),
  ('5', null, 1, 'Liderazgo', 'Compromiso, política y roles de la alta dirección.', 80),
  ('5.1', '5', 2, 'Liderazgo y compromiso', 'Compromiso de la alta dirección con el SGC y con el enfoque al cliente.', 90),
  ('5.1.1', '5.1', 3, 'Generalidades', 'Demostrar liderazgo y compromiso con respecto al SGC.', 100),
  ('5.1.2', '5.1', 3, 'Enfoque al cliente', 'Asegurar que se determinan y cumplen los requisitos del cliente y los legales aplicables.', 110),
  ('5.2', '5', 2, 'Política', 'Política de la calidad de la organización.', 120),
  ('5.2.1', '5.2', 3, 'Establecimiento de la política de la calidad', 'Establecer, implementar y mantener una política de la calidad apropiada.', 130),
  ('5.2.2', '5.2', 3, 'Comunicación de la política de la calidad', 'La política está disponible, se comunica, se entiende y se aplica; disponible para las partes interesadas.', 140),
  ('5.3', '5', 2, 'Roles, responsabilidades y autoridades en la organización', 'Asignar y comunicar responsabilidades y autoridades para los roles pertinentes.', 150),
  ('6', null, 1, 'Planificación', 'Riesgos, oportunidades, objetivos y cambios del SGC.', 160),
  ('6.1', '6', 2, 'Acciones para abordar riesgos y oportunidades', 'Determinar riesgos y oportunidades y planificar acciones para abordarlos.', 170),
  ('6.1.1', '6.1', 3, 'Determinación de riesgos y oportunidades', 'Riesgos y oportunidades que afectan la conformidad y la satisfacción del cliente.', 180),
  ('6.1.2', '6.1', 3, 'Planificación de acciones', 'Acciones para abordar riesgos y oportunidades, integración y evaluación de su eficacia.', 190),
  ('6.2', '6', 2, 'Objetivos de la calidad y planificación para lograrlos', 'Establecer objetivos de la calidad y planificar cómo alcanzarlos.', 200),
  ('6.2.1', '6.2', 3, 'Objetivos de la calidad', 'Objetivos coherentes con la política, medibles, comunicados y actualizados.', 210),
  ('6.2.2', '6.2', 3, 'Planificación para lograr los objetivos', 'Qué se hará, con qué recursos, quién, cuándo y cómo se evaluarán los resultados.', 220),
  ('6.3', '6', 2, 'Planificación de los cambios', 'Planificar los cambios al SGC de manera controlada.', 230),
  ('7', null, 1, 'Apoyo', 'Recursos, competencia, comunicación e información documentada.', 240),
  ('7.1', '7', 2, 'Recursos', 'Determinar y proporcionar los recursos necesarios para el SGC.', 250),
  ('7.1.1', '7.1', 3, 'Generalidades', 'Capacidades y limitaciones de los recursos internos y necesidad de proveedores externos.', 260),
  ('7.1.2', '7.1', 3, 'Personas', 'Personas necesarias para la operación eficaz del SGC y de sus procesos.', 270),
  ('7.1.3', '7.1', 3, 'Infraestructura', 'Edificios, equipos, transporte y tecnologías de la información necesarios.', 280),
  ('7.1.4', '7.1', 3, 'Ambiente para la operación de los procesos', 'Ambiente social, psicológico y físico necesario para la conformidad.', 290),
  ('7.1.5', '7.1', 3, 'Recursos de seguimiento y medición', 'Recursos adecuados para asegurar la validez de los resultados de seguimiento y medición.', 300),
  ('7.1.5.1', '7.1.5', 4, 'Generalidades', 'Recursos para el seguimiento y la medición; conservar evidencia de su idoneidad.', 310),
  ('7.1.5.2', '7.1.5', 4, 'Trazabilidad de las mediciones', 'Calibración o verificación de equipos contra patrones trazables.', 320),
  ('7.1.6', '7.1', 3, 'Conocimientos de la organización', 'Determinar y mantener los conocimientos necesarios para la operación de los procesos.', 330),
  ('7.2', '7', 2, 'Competencia', 'Asegurar la competencia del personal con base en educación, formación o experiencia.', 340),
  ('7.3', '7', 2, 'Toma de conciencia', 'Las personas conocen la política, los objetivos y su contribución al SGC.', 350),
  ('7.4', '7', 2, 'Comunicación', 'Comunicaciones internas y externas pertinentes al SGC.', 360),
  ('7.5', '7', 2, 'Información documentada', 'Información documentada requerida por la norma y por la organización.', 370),
  ('7.5.1', '7.5', 3, 'Generalidades', 'El SGC incluye la información documentada requerida y la que la organización determine necesaria.', 380),
  ('7.5.2', '7.5', 3, 'Creación y actualización', 'Identificación, descripción, formato, revisión y aprobación de la información documentada.', 390),
  ('7.5.3', '7.5', 3, 'Control de la información documentada', 'Disponibilidad, idoneidad y protección de la información documentada.', 400),
  ('7.5.3.1', '7.5.3', 4, 'Disponibilidad y protección', 'Disponible y adecuadamente protegida contra pérdida de confidencialidad o integridad.', 410),
  ('7.5.3.2', '7.5.3', 4, 'Distribución, acceso, conservación y disposición', 'Distribución, acceso, recuperación, uso, almacenamiento, control de cambios y retención.', 420),
  ('8', null, 1, 'Operación', 'Planificación y control de la realización de productos y servicios.', 430),
  ('8.1', '8', 2, 'Planificación y control operacional', 'Planificar, implementar y controlar los procesos necesarios para cumplir los requisitos.', 440),
  ('8.2', '8', 2, 'Requisitos para los productos y servicios', 'Comunicación con el cliente y determinación y revisión de requisitos.', 450),
  ('8.2.1', '8.2', 3, 'Comunicación con el cliente', 'Información sobre productos y servicios, consultas, retroalimentación y propiedad del cliente.', 460),
  ('8.2.2', '8.2', 3, 'Determinación de los requisitos para los productos y servicios', 'Requisitos legales, reglamentarios y los que la organización considere necesarios.', 470),
  ('8.2.3', '8.2', 3, 'Revisión de los requisitos para los productos y servicios', 'Revisar la capacidad de cumplir los requisitos antes de comprometerse a suministrar.', 480),
  ('8.2.3.1', '8.2.3', 4, 'Revisión antes del compromiso', 'Requisitos del cliente, no establecidos, propios, legales y diferencias con contrato previo.', 490),
  ('8.2.3.2', '8.2.3', 4, 'Conservación de información de la revisión', 'Información documentada de los resultados de la revisión y de los nuevos requisitos.', 500),
  ('8.2.4', '8.2', 3, 'Cambios en los requisitos para los productos y servicios', 'Modificar la información documentada y comunicar los cambios al personal pertinente.', 510),
  ('8.3', '8', 2, 'Diseño y desarrollo de los productos y servicios', 'Proceso de diseño y desarrollo adecuado para asegurar la provisión posterior.', 520),
  ('8.3.1', '8.3', 3, 'Generalidades', 'Establecer, implementar y mantener un proceso de diseño y desarrollo.', 530),
  ('8.3.2', '8.3', 3, 'Planificación del diseño y desarrollo', 'Etapas, revisiones, verificación, validación, responsabilidades y recursos.', 540),
  ('8.3.3', '8.3', 3, 'Entradas para el diseño y desarrollo', 'Requisitos funcionales y de desempeño, legales, normas y consecuencias de fallo.', 550),
  ('8.3.4', '8.3', 3, 'Controles del diseño y desarrollo', 'Revisiones, verificaciones y validaciones para asegurar los resultados previstos.', 560),
  ('8.3.5', '8.3', 3, 'Salidas del diseño y desarrollo', 'Salidas que cumplen los requisitos de entrada y son adecuadas para los procesos posteriores.', 570),
  ('8.3.6', '8.3', 3, 'Cambios del diseño y desarrollo', 'Identificar, revisar y controlar los cambios para evitar impacto adverso.', 580),
  ('8.4', '8', 2, 'Control de los procesos, productos y servicios suministrados externamente', 'Asegurar que lo suministrado externamente es conforme a los requisitos.', 590),
  ('8.4.1', '8.4', 3, 'Generalidades', 'Criterios para evaluar, seleccionar, hacer seguimiento y reevaluar proveedores externos.', 600),
  ('8.4.2', '8.4', 3, 'Tipo y alcance del control', 'Asegurar que lo suministrado externamente no afecta la capacidad de entregar conformes.', 610),
  ('8.4.3', '8.4', 3, 'Información para los proveedores externos', 'Comunicar requisitos de procesos, productos, servicios, competencia e interacciones.', 620),
  ('8.5', '8', 2, 'Producción y provisión del servicio', 'Implementar la producción y la provisión del servicio bajo condiciones controladas.', 630),
  ('8.5.1', '8.5', 3, 'Control de la producción y de la provisión del servicio', 'Información documentada, recursos de seguimiento, validación, competencia y prevención de errores.', 640),
  ('8.5.2', '8.5', 3, 'Identificación y trazabilidad', 'Identificar las salidas y su estado; controlar la identificación única cuando sea un requisito.', 650),
  ('8.5.3', '8.5', 3, 'Propiedad perteneciente a los clientes o proveedores externos', 'Cuidar, identificar, verificar y proteger la propiedad de terceros.', 660),
  ('8.5.4', '8.5', 3, 'Preservación', 'Preservar las salidas durante la producción y la prestación del servicio.', 670),
  ('8.5.5', '8.5', 3, 'Actividades posteriores a la entrega', 'Cumplir los requisitos de garantía, mantenimiento y servicios posteriores a la entrega.', 680),
  ('8.5.6', '8.5', 3, 'Control de los cambios', 'Revisar y controlar los cambios para asegurar la conformidad continua.', 690),
  ('8.6', '8', 2, 'Liberación de los productos y servicios', 'Verificar el cumplimiento de requisitos antes de liberar al cliente.', 700),
  ('8.7', '8', 2, 'Control de las salidas no conformes', 'Identificar y controlar las salidas que no cumplen los requisitos.', 710),
  ('8.7.1', '8.7', 3, 'Tratamiento de las salidas no conformes', 'Corrección, segregación, contención, devolución, suspensión e información al cliente.', 720),
  ('8.7.2', '8.7', 3, 'Información documentada de las salidas no conformes', 'Conservar información sobre la no conformidad, acciones, concesiones y autoridad de decisión.', 730),
  ('9', null, 1, 'Evaluación del desempeño', 'Seguimiento, medición, auditoría interna y revisión por la dirección.', 740),
  ('9.1', '9', 2, 'Seguimiento, medición, análisis y evaluación', 'Determinar qué, cómo y cuándo se realiza el seguimiento y la medición.', 750),
  ('9.1.1', '9.1', 3, 'Generalidades', 'Métodos de seguimiento, medición, análisis y evaluación, y cuándo analizar los resultados.', 760),
  ('9.1.2', '9.1', 3, 'Satisfacción del cliente', 'Seguimiento de la percepción del cliente sobre el cumplimiento de sus necesidades.', 770),
  ('9.1.3', '9.1', 3, 'Análisis y evaluación', 'Analizar datos para evaluar conformidad, desempeño, eficacia, riesgos y proveedores.', 780),
  ('9.2', '9', 2, 'Auditoría interna', 'Auditorías internas a intervalos planificados.', 790),
  ('9.2.1', '9.2', 3, 'Programa de auditoría interna', 'Información sobre si el SGC es conforme y se implementa eficazmente.', 800),
  ('9.2.2', '9.2', 3, 'Criterios, informe y seguimiento', 'Criterios y alcance, objetividad, informe a la dirección y acciones sin demora indebida.', 810),
  ('9.3', '9', 2, 'Revisión por la dirección', 'Revisar el SGC a intervalos planificados para asegurar su idoneidad, adecuación y eficacia.', 820),
  ('9.3.1', '9.3', 3, 'Generalidades', 'La alta dirección revisa el SGC de la organización a intervalos planificados.', 830),
  ('9.3.2', '9.3', 3, 'Entradas de la revisión por la dirección', 'Estado de acciones previas, cambios, desempeño, recursos, riesgos y oportunidades de mejora.', 840),
  ('9.3.3', '9.3', 3, 'Salidas de la revisión por la dirección', 'Decisiones y acciones sobre oportunidades de mejora, cambios del SGC y necesidades de recursos.', 850),
  ('10', null, 1, 'Mejora', 'No conformidades, acciones correctivas y mejora continua.', 860),
  ('10.1', '10', 2, 'Generalidades', 'Determinar y seleccionar oportunidades de mejora e implementar acciones necesarias.', 870),
  ('10.2', '10', 2, 'No conformidad y acción correctiva', 'Reaccionar ante las no conformidades y tomar acciones correctivas.', 880),
  ('10.2.1', '10.2', 3, 'Reacción ante la no conformidad', 'Controlar, corregir, evaluar la necesidad de acciones, implementarlas y revisar su eficacia.', 890),
  ('10.2.2', '10.2', 3, 'Conservación de información documentada', 'Naturaleza de las no conformidades, acciones tomadas y resultados de las acciones correctivas.', 900),
  ('10.3', '10', 2, 'Mejora continua', 'Mejorar continuamente la conveniencia, adecuación y eficacia del SGC.', 910)

on conflict (code) do update set
  parent_code = excluded.parent_code,
  level       = excluded.level,
  title       = excluded.title,
  description = excluded.description,
  sort_order  = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- 2. Documentos: version, huella SHA-256 y estado "en revision"
-- ----------------------------------------------------------------------------
alter type public.document_status add value if not exists 'en_revision';

alter table public.documents add column if not exists version text not null default 'v.01';
alter table public.documents add column if not exists sha256  text;

create index if not exists idx_documents_clause on public.documents(clause);

-- ----------------------------------------------------------------------------
-- 3. Firmas electronicas de documentos (y solicitudes de firma)
-- ----------------------------------------------------------------------------
-- Una fila por (documento, firmante). Nace como 'pendiente' cuando alguien
-- solicita la firma y pasa a 'firmada' cuando el firmante la emite. Una firma
-- emitida es inmutable (trigger) y queda ligada a la huella SHA-256 del archivo.
create table if not exists public.document_signatures (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.documents(id) on delete cascade,
  signer_id         uuid not null references public.profiles(id) on delete cascade,
  status            text not null default 'pendiente' check (status in ('pendiente','firmada')),
  requested_by      uuid references public.profiles(id) on delete set null,
  requested_at      timestamptz,
  request_message   text,
  signed_at         timestamptz,
  signer_name       text,
  signer_role       text,
  signature_image   text check (signature_image is null or length(signature_image) <= 400000),
  document_sha256   text,
  signature_hash    text,
  comment           text,
  ip_address        text,
  user_agent        text,
  last_reminded_at  timestamptz,
  reminder_count    integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (document_id, signer_id)
);

create index if not exists idx_document_signatures_document on public.document_signatures(document_id);
create index if not exists idx_document_signatures_signer_status on public.document_signatures(signer_id, status);

drop trigger if exists trg_document_signatures_updated_at on public.document_signatures;
create trigger trg_document_signatures_updated_at
  before update on public.document_signatures
  for each row execute function public.set_updated_at();

create or replace function public.prevent_signed_signature_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'firmada' then
    raise exception 'Una firma emitida no puede modificarse';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_signed_signature_change on public.document_signatures;
create trigger trg_prevent_signed_signature_change
  before update on public.document_signatures
  for each row execute function public.prevent_signed_signature_change();

revoke all on function public.prevent_signed_signature_change() from public, anon, authenticated;

alter table public.document_signatures enable row level security;

-- Solo lectura desde el cliente. Las firmas y solicitudes las escribe unicamente
-- el backend (service role) para que nadie pueda fabricar una firma.
drop policy if exists document_signatures_select_active on public.document_signatures;
create policy document_signatures_select_active on public.document_signatures
  for select to authenticated using (public.is_active_user());

-- ----------------------------------------------------------------------------
-- 4. Notificaciones por usuario
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          text not null default 'info',
  severity      text not null default 'info' check (severity in ('info','success','warning','error')),
  title         text not null,
  message       text,
  link          text,
  entity_type   text,
  entity_id     uuid,
  created_by    uuid references public.profiles(id) on delete set null,
  read_at       timestamptz,
  resend_count  integer not null default 0,
  last_sent_at  timestamptz not null default now(),
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index if not exists idx_notifications_entity on public.notifications(entity_type, entity_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. Storage: mas tipos de archivo y limite de 25 MB para documentos
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 6. Privilegios explicitos (no depender de los default privileges del proyecto)
-- ----------------------------------------------------------------------------
-- Los default privileges de Supabase otorgan todo a anon/authenticated sobre tablas
-- nuevas; RLS frena las filas, pero TRUNCATE/REFERENCES/TRIGGER no pasan por RLS.
-- Se revoca todo y se concede solo lo estrictamente necesario.
revoke all on public.iso_clauses, public.document_signatures, public.notifications from anon, authenticated;

grant select on public.iso_clauses, public.document_signatures, public.notifications to authenticated;
-- El cliente solo puede marcar como leida o borrar sus notificaciones;
-- crear y reenviar es exclusivo del backend (service role).
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

grant select, insert, update, delete on
  public.iso_clauses, public.document_signatures, public.notifications
to service_role;
