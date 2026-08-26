create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_not_blank check (length(trim(name)) > 0),
  constraint tags_name_length check (length(trim(name)) <= 40),
  constraint tags_id_organization_unique unique (id, organization_id)
);

create unique index tags_organization_name_unique
on public.tags (organization_id, lower(trim(name)));

create index tags_organization_id_idx on public.tags (organization_id);

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

create table public.client_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (client_id, tag_id),
  constraint client_tags_client_organization_fk
    foreign key (client_id, organization_id)
    references public.clients(id, organization_id)
    on delete cascade,
  constraint client_tags_tag_organization_fk
    foreign key (tag_id, organization_id)
    references public.tags(id, organization_id)
    on delete cascade
);

create index client_tags_organization_id_idx on public.client_tags (organization_id);
create index client_tags_tag_id_idx on public.client_tags (tag_id);

alter table public.tags enable row level security;
alter table public.client_tags enable row level security;

create policy "Members can read organization tags" on public.tags
for select using (public.is_organization_member(organization_id));

create policy "Members can insert organization tags" on public.tags
for insert with check (
  public.is_organization_member(organization_id)
  and auth.uid() = created_by
);

create policy "Members can update organization tags" on public.tags
for update using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can delete organization tags" on public.tags
for delete using (public.is_organization_member(organization_id));

create policy "Members can read organization client tags" on public.client_tags
for select using (public.is_organization_member(organization_id));

create policy "Members can insert organization client tags" on public.client_tags
for insert with check (public.is_organization_member(organization_id));

create policy "Members can delete organization client tags" on public.client_tags
for delete using (public.is_organization_member(organization_id));
