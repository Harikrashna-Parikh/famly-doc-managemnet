-- ==========================================
-- FAMILY DIGITAL DOCUMENT LOCKER - RLS POLICIES
-- File: supabase/rls.sql
-- ==========================================

-- ==========================================
-- STEP 1: Drop is_admin + all dependent policies (CASCADE), then has_member_access
-- Run this full script in Supabase SQL Editor at once.
-- ==========================================
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_member_access(UUID, UUID) CASCADE;

-- ==========================================
-- STEP 2: Recreate helper functions
-- NOTE: Using SQL language (not plpgsql) enables function inlining.
--       SECURITY DEFINER makes the function run as its owner, bypassing
--       RLS when it queries the profiles table.
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' AND is_active = true
         FROM public.profiles
         WHERE user_id = check_user_id),
        false
    );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_member_access(p_user_id UUID, p_member_id UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_admin(p_user_id) OR EXISTS (
        SELECT 1
        FROM public.member_access ma
        JOIN public.profiles p ON p.user_id = ma.user_id
        WHERE ma.user_id = p_user_id
          AND ma.family_member_id = p_member_id
          AND p.is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- STEP 3: Enable RLS on all tables (idempotent)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES POLICIES
-- CRITICAL: The SELECT policy does NOT call is_admin() to avoid infinite
-- recursion (is_admin queries profiles -> triggers SELECT policy -> loop).
-- Uses direct auth.uid() = user_id + inline EXISTS for admin check instead.
-- ==========================================
CREATE POLICY "Allow users to read own profile or admins to read all"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND p.role = 'admin'
              AND p.is_active = true
        )
    );

CREATE POLICY "Allow users to create their own profile"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update own profile or admins to update all"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Allow only admins to delete profiles"
    ON public.profiles FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- Profile update restrictions trigger (recreated after CASCADE dropped it)
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS trigger AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        IF new.role IS DISTINCT FROM old.role
           OR new.is_active IS DISTINCT FROM old.is_active
           OR new.user_id IS DISTINCT FROM old.user_id THEN
            RAISE EXCEPTION 'Unauthorized to modify role, activity status, or user ID';
        END IF;
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS before_profile_update ON public.profiles;
CREATE TRIGGER before_profile_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();

-- ==========================================
-- FAMILY MEMBERS POLICIES
-- ==========================================
CREATE POLICY "Allow read access to authorized members or admins"
    ON public.family_members FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()) OR (is_active = true AND public.has_member_access(auth.uid(), id)));

CREATE POLICY "Admins have full write access to family_members"
    ON public.family_members FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- ==========================================
-- MEMBER ACCESS POLICIES
-- ==========================================
CREATE POLICY "Allow users to read own access or admins to read all"
    ON public.member_access FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins have full write access to member_access"
    ON public.member_access FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- ==========================================
-- CATEGORIES POLICIES
-- ==========================================
CREATE POLICY "Allow read access to all authenticated users"
    ON public.categories FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admins have full write access to categories"
    ON public.categories FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- ==========================================
-- DOCUMENTS POLICIES
-- ==========================================
CREATE POLICY "Allow read access to authorized documents or admins"
    ON public.documents FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()) OR public.has_member_access(auth.uid(), family_member_id));

CREATE POLICY "Admins have full write access to documents"
    ON public.documents FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));
