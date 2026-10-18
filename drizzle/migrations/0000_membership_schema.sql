create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_label text,
  tagline text,
  features jsonb not null default '[]'::jsonb,
  infinitepay_url text,
  mercadopago_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.plans to anon;
grant select on public.plans to authenticated;
grant insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "Anyone can view active plans" on public.plans for select using (is_active = true);
create policy "Admins view all plans" on public.plans for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage plans" on public.plans for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  video_url text,
  access_type text not null default 'subscription' check (access_type in ('subscription','purchase')),
  price_label text,
  purchase_url text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.videos to anon;
grant select on public.videos to authenticated;
grant insert, update, delete on public.videos to authenticated;
grant all on public.videos to service_role;
alter table public.videos enable row level security;
create policy "Anyone can view published videos" on public.videos for select using (is_published = true);
create policy "Admins view all videos" on public.videos for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage videos" on public.videos for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid references public.plans on delete set null,
  provider text not null default 'infinitepay' check (provider in ('infinitepay','mercadopago')),
  status text not null default 'pending' check (status in ('pending','active','canceled')),
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users view own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "Users request subscription" on public.subscriptions for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
create policy "Admins view all subscriptions" on public.subscriptions for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  video_id uuid references public.videos on delete cascade,
  provider text not null default 'infinitepay' check (provider in ('infinitepay','mercadopago')),
  status text not null default 'pending' check (status in ('pending','paid','canceled')),
  created_at timestamptz not null default now()
);
grant select, insert on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
create policy "Users view own purchases" on public.purchases for select to authenticated using (auth.uid() = user_id);
create policy "Users request purchase" on public.purchases for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
create policy "Admins view all purchases" on public.purchases for select to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;