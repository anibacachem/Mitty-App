-- Mitty App: tablas base. Pégalo en Supabase (SQL Editor -> New query -> Run) ANTES de supabase/metas_dia.sql.
-- Es seguro correrlo más de una vez. Solo se usan datos inventados.

-- Una fila por pareja: su código y los dos nombres (nombre0 = persona 0, nombre1 = persona 1).
create table if not exists parejas (
  codigo   text primary key,
  nombre0  text not null,
  nombre1  text not null,
  creada   timestamptz default now()
);

-- Gastos y pagos. "fecha" es cuándo ocurrió el gasto y "creado" cuándo se anotó.
--   tipo:     mitad (50/50), fraccion (partes distintas), invita (gasto de quien invitó),
--             por_otro (era todo del otro), personal (gasto de una sola persona), pago (saldar deuda)
--   pagador:  0 o 1, quién puso la plata
--   dueno:    0 o 1, solo en invita y personal: quién invitó / de quién es el gasto. Si es distinto
--             de quien pagó, el dueño le debe todo. Vacío = quien pagó (supabase/dueno.sql lo agrega
--             a una base que ya existía)
--   parte0/parte1: solo en "fraccion", lo que le toca a cada uno; deben sumar el monto
create table if not exists movimientos (
  id           text primary key,
  codigo       text not null references parejas(codigo) on delete cascade,
  descripcion  text not null,
  monto        numeric not null check (monto > 0),
  pagador      int not null check (pagador in (0, 1)),
  tipo         text not null check (tipo in ('mitad','por_otro','invita','personal','pago','fraccion')),
  categoria    text default '',
  fecha        date not null,
  creado       timestamptz default now(),
  parte0       numeric,
  parte1       numeric,
  dueno        int check (dueno is null or dueno in (0, 1)),
  constraint movimientos_fraccion_check
    check (tipo <> 'fraccion'
           or (parte0 is not null and parte1 is not null
               and parte0 >= 0 and parte1 >= 0
               and parte0 + parte1 = monto))
);

create index if not exists movimientos_codigo_idx on movimientos (codigo);

-- Seguridad: la app envía el código de la pareja en el header "x-pareja"
-- y la base solo entrega o acepta filas con ese código.
alter table parejas     enable row level security;
alter table movimientos enable row level security;

drop policy if exists "solo_mi_pareja" on parejas;
create policy "solo_mi_pareja" on parejas
  for all
  using      (codigo = (current_setting('request.headers', true)::json ->> 'x-pareja'))
  with check (codigo = (current_setting('request.headers', true)::json ->> 'x-pareja'));

drop policy if exists "solo_mis_movimientos" on movimientos;
create policy "solo_mis_movimientos" on movimientos
  for all
  using      (codigo = (current_setting('request.headers', true)::json ->> 'x-pareja'))
  with check (codigo = (current_setting('request.headers', true)::json ->> 'x-pareja'));
