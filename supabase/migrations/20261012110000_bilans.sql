-- Lot 6 — Bilans (étape 6.2) : regroupement des rapports validés en bilans.
--
-- Un bilan regroupe, pour UNE école et UNE période (une semaine du lundi au
-- dimanche, ou un mois entier), les rapports journaliers VALIDÉS par la
-- Direction. Il ne contient que des liens vers les rapports : leur contenu est
-- verrouillé une fois validé, il ne change plus.
--
-- Cette étape crée les bilans en brouillon. Le fichier Word (6.3), le PDF final
-- et la publication (6.4) viennent ensuite. Aucune suppression physique.

-- ---------------------------------------------------------------------------
-- bilans : un bilan par école et par période
-- ---------------------------------------------------------------------------
create table public.bilans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  period_kind text not null check (period_kind in ('semaine', 'mois')),
  -- Période incluse : lundi → dimanche, ou 1er → dernier jour du mois.
  period_start date not null,
  period_end date not null,
  status text not null default 'brouillon'
    check (status in ('brouillon', 'publie')),
  generated_by text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- La période a la forme annoncée (la base ne fait pas confiance à l'application).
  check (
    (period_kind = 'semaine'
      and extract(isodow from period_start) = 1
      and period_end = period_start + 6)
    or (period_kind = 'mois'
      and extract(day from period_start) = 1
      and period_end = (period_start + interval '1 month - 1 day')::date)
  )
);

-- Un seul bilan par école et par période.
create unique index bilans_school_period_unique
  on public.bilans (school_id, period_kind, period_start);

create index bilans_period_idx on public.bilans (period_start desc, school_id);

create trigger bilans_set_updated_at
  before update on public.bilans
  for each row execute function public.set_updated_at();

-- Garde-fou : l'école et la période d'un bilan ne changent jamais, et un bilan
-- publié ne redevient pas brouillon.
create or replace function public.guard_bilan()
returns trigger
language plpgsql
as $$
begin
  if new.school_id <> old.school_id
     or new.period_kind <> old.period_kind
     or new.period_start <> old.period_start
     or new.period_end <> old.period_end then
    raise exception 'L''école et la période d''un bilan ne se modifient pas.'
      using errcode = '23514';
  end if;
  if old.status = 'publie' and new.status <> 'publie' then
    raise exception 'Un bilan publié ne redevient pas brouillon.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bilans_guard
  before update on public.bilans
  for each row execute function public.guard_bilan();

-- ---------------------------------------------------------------------------
-- bilan_reports : les rapports inclus dans un bilan
-- ---------------------------------------------------------------------------
create table public.bilan_reports (
  bilan_id uuid not null references public.bilans (id),
  report_id uuid not null references public.daily_reports (id),
  added_at timestamptz not null default now(),
  primary key (bilan_id, report_id)
);

create index bilan_reports_report_idx on public.bilan_reports (report_id);

-- Garde-fou d'intégrité (même si l'application se trompe) : on n'ajoute un
-- rapport qu'à un bilan EN BROUILLON, s'il est validé, de la même école, et
-- daté dans la période du bilan.
create or replace function public.guard_bilan_report()
returns trigger
language plpgsql
as $$
declare
  v_bilan public.bilans%rowtype;
  v_report public.daily_reports%rowtype;
begin
  select * into v_bilan from public.bilans where id = new.bilan_id;
  select * into v_report from public.daily_reports where id = new.report_id;

  if v_bilan.status <> 'brouillon' then
    raise exception 'Un bilan publié est figé.' using errcode = '23514';
  end if;
  if v_report.status not in ('valide', 'valide_avec_corrections') then
    raise exception 'Seuls les rapports validés entrent dans un bilan.'
      using errcode = '23514';
  end if;
  if v_report.school_id <> v_bilan.school_id then
    raise exception 'Ce rapport appartient à une autre école.'
      using errcode = '23514';
  end if;
  if v_report.report_date not between v_bilan.period_start and v_bilan.period_end then
    raise exception 'Ce rapport est hors de la période du bilan.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bilan_reports_guard
  before insert on public.bilan_reports
  for each row execute function public.guard_bilan_report();

-- ---------------------------------------------------------------------------
-- RLS : la Direction pédagogique (Admin Pédagogie et Super-Admin)
-- ---------------------------------------------------------------------------
alter table public.bilans enable row level security;
alter table public.bilan_reports enable row level security;

create policy "bilans_select"
  on public.bilans for select to authenticated
  using (public.is_pedagogy_manager());

create policy "bilans_insert"
  on public.bilans for insert to authenticated
  with check (public.is_pedagogy_manager());

create policy "bilans_update"
  on public.bilans for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

create policy "bilan_reports_select"
  on public.bilan_reports for select to authenticated
  using (public.is_pedagogy_manager());

create policy "bilan_reports_insert"
  on public.bilan_reports for insert to authenticated
  with check (public.is_pedagogy_manager());

-- Pas de suppression physique, rien pour les visiteurs anonymes, et un lien
-- bilan ↔ rapport ne se modifie pas.
revoke all on public.bilans, public.bilan_reports from anon;
revoke delete, truncate on public.bilans from authenticated;
revoke update, delete, truncate on public.bilan_reports from authenticated;

-- ---------------------------------------------------------------------------
-- generate_bilans : le bouton « Générer », en une seule transaction
-- ---------------------------------------------------------------------------
-- Pour la période donnée (une semaine qui commence un lundi, ou un mois qui
-- commence le 1er), crée ou actualise un bilan pour CHAQUE école qui a au moins
-- un rapport validé :
--   - pas encore de bilan        -> « cree » ;
--   - bilan en brouillon         -> « actualise » (les rapports validés depuis
--                                    sont ajoutés ; on n'en retire jamais, un
--                                    rapport validé ne devient pas non validé) ;
--   - bilan déjà publié          -> « ignore » (figé).
-- Elle s'exécute avec les droits de l'appelant : la RLS et les garde-fous
-- s'appliquent. Les écoles sans rapport validé n'ont pas de bilan.
create or replace function public.generate_bilans(p_kind text, p_start date)
returns table (
  out_school_id uuid,
  out_bilan_id uuid,
  out_report_count integer,
  out_outcome text
)
language plpgsql
as $$
declare
  v_end date;
  v_school uuid;
  v_bilan public.bilans%rowtype;
  v_outcome text;
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  if p_kind = 'semaine' then
    if extract(isodow from p_start) <> 1 then
      raise exception 'Une semaine commence un lundi.' using errcode = '23514';
    end if;
    v_end := p_start + 6;
  elsif p_kind = 'mois' then
    if extract(day from p_start) <> 1 then
      raise exception 'Un mois commence le 1er.' using errcode = '23514';
    end if;
    v_end := (p_start + interval '1 month - 1 day')::date;
  else
    raise exception 'Période invalide.' using errcode = '23514';
  end if;

  for v_school in
    select distinct r.school_id
    from public.daily_reports r
    where r.status in ('valide', 'valide_avec_corrections')
      and r.report_date between p_start and v_end
    order by 1
  loop
    select * into v_bilan
      from public.bilans b
      where b.school_id = v_school
        and b.period_kind = p_kind
        and b.period_start = p_start
      for update;

    if not found then
      insert into public.bilans (school_id, period_kind, period_start, period_end, generated_by)
        values (v_school, p_kind, p_start, v_end, public.current_clerk_id())
        returning * into v_bilan;
      v_outcome := 'cree';
    elsif v_bilan.status <> 'brouillon' then
      v_outcome := 'ignore';
    else
      update public.bilans
        set generated_at = now(), generated_by = public.current_clerk_id()
        where id = v_bilan.id;
      v_outcome := 'actualise';
    end if;

    if v_outcome <> 'ignore' then
      insert into public.bilan_reports (bilan_id, report_id)
        select v_bilan.id, r.id
        from public.daily_reports r
        where r.school_id = v_school
          and r.status in ('valide', 'valide_avec_corrections')
          and r.report_date between p_start and v_end
        on conflict do nothing;
    end if;

    out_school_id := v_school;
    out_bilan_id := v_bilan.id;
    select count(*)::integer into out_report_count
      from public.bilan_reports br where br.bilan_id = v_bilan.id;
    out_outcome := v_outcome;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_bilans(text, date) from public, anon;
grant execute on function public.generate_bilans(text, date) to authenticated;
