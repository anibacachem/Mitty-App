-- Mitty App: días en que la pareja declara que hubo menos gastos compartidos que la meta (3).
-- Pégalo en Supabase: SQL Editor -> New query -> Run. Debe responder "Success. No rows returned".
-- Es seguro correrlo más de una vez.

-- Una fila por pareja y día. "esperados" es cuántos gastos compartidos hubo ese día (0, 1 o 2).
-- "declarado_por" es quién lo declaró: 0 = nombre0, 1 = nombre1 (igual que "pagador" en movimientos).
create table if not exists metas_dia (
  codigo         text not null references parejas(codigo) on delete cascade,
  fecha          date not null,
  esperados      int  not null check (esperados between 0 and 2),
  declarado_por  int  not null check (declarado_por in (0, 1)),
  primary key (codigo, fecha)
);

-- Seguridad: igual que las otras tablas, solo se ve y se cambia lo de tu pareja (header x-pareja).
alter table metas_dia enable row level security;

drop policy if exists "solo_mis_metas" on metas_dia;
create policy "solo_mis_metas" on metas_dia
  for all
  using      (codigo = (current_setting('request.headers', true)::json ->> 'x-pareja'))
  with check (codigo = (current_setting('request.headers', true)::json ->> 'x-pareja'));
