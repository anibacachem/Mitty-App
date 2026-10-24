-- Mitty App: separa "de quién es el gasto" de "quién pagó" (para Invitación y Gasto personal).
-- Pégalo en Supabase (SQL Editor -> New query -> Run). Es seguro correrlo más de una vez.
--   dueno: 0 o 1. Quién invitó (Invitación) o de quién es el gasto (Gasto personal).
--          Si está vacío, se asume que es quien pagó (así funcionan los gastos antiguos).
--   Si dueno y pagador son distintos, el dueño le debe todo el monto a quien pagó.
alter table movimientos add column if not exists dueno int;
alter table movimientos drop constraint if exists movimientos_dueno_check;
alter table movimientos add constraint movimientos_dueno_check check (dueno is null or dueno in (0, 1));
