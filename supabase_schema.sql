-- ==========================================
-- KRISHOK BAZAR INTERNAL BANGLADESHI MARKETPLACE
-- SUPABASE DATABASE SCHEMA & INITIAL SEED
-- ==========================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLES
-- Profiles Table (manages users / auth relations)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    phone text,
    name text not null,
    role text not null check (role in ('admin', 'operator')),
    approved boolean not null default false,
    created_at timestamptz not null default now()
);

-- Customers Table
create table public.customers (
    id uuid primary key default gen_random_uuid(),
    phone text not null unique,
    name text not null,
    address text,
    total_orders integer not null default 0,
    total_spent numeric not null default 0,
    total_returns integer not null default 0,
    last_order_date timestamptz,
    created_at timestamptz not null default now()
);

-- Orders Table
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers(id) on delete restrict,
    operator_id uuid not null references public.profiles(id) on delete restrict,
    amount numeric not null,
    status text not null check (status in ('delivery', 'return')),
    product_cost numeric not null default 0,
    delivery_cost numeric not null default 0,
    other_costs numeric not null default 0,
    total_cost numeric not null default 0,
    profit numeric not null default 0,
    order_date timestamptz not null default now(),
    notes text,
    created_at timestamptz not null default now()
);

-- Cost Settings Table (Singleton: exactly 1 row)
create table public.cost_settings (
    id integer primary key default 1 check (id = 1),
    product_cost_percent numeric not null default 40, -- 40%
    default_delivery_cost numeric not null default 50, -- 50 BDT
    other_fixed_cost numeric not null default 0,
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

-- Insert default single settings row
insert into public.cost_settings (id, product_cost_percent, default_delivery_cost, other_fixed_cost)
values (1, 40, 50, 0)
on conflict (id) do nothing;


-- 3. TRIGGERS & FUNCTIONS FOR AGGREGATES
-- Automate calculations for customer profile order stats
create or replace function public.update_customer_stats()
returns trigger as $$
declare
    target_cust_id uuid;
begin
    target_cust_id := coalesce(NEW.customer_id, OLD.customer_id);

    update public.customers
    set 
        total_orders = (select count(*) from public.orders where customer_id = target_cust_id),
        total_spent = coalesce((select sum(amount) from public.orders where customer_id = target_cust_id and status = 'delivery'), 0),
        total_returns = (select count(*) from public.orders where customer_id = target_cust_id and status = 'return'),
        last_order_date = (select max(order_date) from public.orders where customer_id = target_cust_id)
    where id = target_cust_id;

    return null;
end;
$$ language plpgsql security definer;

create trigger trg_orders_stats
after insert or update or delete on public.orders
for each row execute function public.update_customer_stats();


-- 4. PROFILE TRIGGERS FOR NEW USERS
-- Automatically create profile row when user signs up (for email/auth linking)
create or replace function public.handle_new_user()
returns trigger as $$
declare
    user_metadata jsonb;
    u_role text;
    u_phone text;
    u_name text;
    is_approved boolean;
begin
    user_metadata := NEW.raw_user_meta_data;
    u_role := coalesce(user_metadata->>'role', 'operator');
    u_name := coalesce(user_metadata->>'name', split_part(NEW.email, '@', 1));
    u_phone := coalesce(NEW.phone, user_metadata->>'phone');
    
    -- Auto approve admin setup or fallback
    if NEW.email = 'ajzakir004@gmail.com' then
        u_role := 'admin';
        is_approved := true;
    else
        is_approved := false;
    end if;

    insert into public.profiles (id, email, phone, name, role, approved, created_at)
    values (NEW.id, NEW.email, u_phone, u_name, u_role, is_approved, now())
    on conflict (id) do update
    set role = excluded.role, approved = excluded.approved, name = excluded.name;

    return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- 5. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.cost_settings enable row level security;

-- Profiles Policies
create policy "Anyone approved can read profiles" on public.profiles
    for select using (auth.uid() is not null);

create policy "Admins can modify profiles" on public.profiles
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );

create policy "Allow self signup insertions" on public.profiles
    for insert with check (auth.uid() = id);

-- Customers Policies
create policy "Operators and admins can read customers" on public.customers
    for select using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and approved = true
        )
    );

create policy "Operators and admins can insert customers" on public.customers
    for insert with check (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and approved = true
        )
    );

create policy "Admins can update or delete customers" on public.customers
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );

-- Orders Policies
create policy "Operators and admins can read orders" on public.orders
    for select using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and approved = true
        )
    );

create policy "Operators can insert orders" on public.orders
    for insert with check (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and approved = true
        )
    );

create policy "Admins can modify and delete orders" on public.orders
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );

-- Cost Settings Policies
create policy "Approved operators and admins can read cost settings" on public.cost_settings
    for select using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and approved = true
        )
    );

create policy "Admins can manage cost settings" on public.cost_settings
    for all using (
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'admin'
        )
    );


-- ==========================================
-- 6. INSTRUCTIONS TO REGISTER THE DEFAULT ADMIN
-- ==========================================
-- Sign up via the admin interface with:
-- Email: ajzakir004@gmail.com
-- Password: Ajzakir@2020
-- The trigger public.handle_new_user() will automatically assign role = 'admin' and approved = true.
