-- Salon POS: cloud replication table. Jalankan sekali di Supabase > SQL Editor.
-- Satu tabel generik: tiap baris = satu baris tabel lokal (tbl, pk, data JSON).
-- seq naik tiap kali baris berubah, dipakai device sebagai cursor "ambil yang lebih baru".

create sequence if not exists public.sync_seq;

create table if not exists public.sync_rows (
  tbl        text        not null,
  pk         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  device     text,
  seq        bigint      not null default nextval('public.sync_seq'),
  updated_at timestamptz not null default now(),
  primary key (tbl, pk)
);

create index if not exists sync_rows_seq_idx on public.sync_rows (seq);

create or replace function public.sync_rows_touch()
returns trigger language plpgsql as $$
begin
  new.seq := nextval('public.sync_seq');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sync_rows_touch on public.sync_rows;
create trigger sync_rows_touch
  before insert or update on public.sync_rows
  for each row execute function public.sync_rows_touch();

-- Keamanan: hanya user yang sudah login (akun outlet) yang boleh baca/tulis.
-- Anon key saja TIDAK cukup untuk membaca data.
alter table public.sync_rows enable row level security;

drop policy if exists "outlet select" on public.sync_rows;
drop policy if exists "outlet insert" on public.sync_rows;
drop policy if exists "outlet update" on public.sync_rows;
create policy "outlet select" on public.sync_rows for select to authenticated using (true);
create policy "outlet insert" on public.sync_rows for insert to authenticated with check (true);
create policy "outlet update" on public.sync_rows for update to authenticated using (true) with check (true);

revoke all on public.sync_rows from anon;
grant select, insert, update on public.sync_rows to authenticated;
grant usage, select on sequence public.sync_seq to authenticated;
