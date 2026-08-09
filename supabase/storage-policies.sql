-- ==========================================
-- FAMILY DIGITAL DOCUMENT LOCKER - STORAGE POLICIES
-- File: supabase/storage-policies.sql
-- ==========================================

-- 1. Create the private 'documents' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents', 
    'documents', 
    false, -- Private bucket
    52428800, -- 50 MB in bytes
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Helper function to safely cast text to UUID without throwing exceptions
CREATE OR REPLACE FUNCTION public.safe_uuid(text_val TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN text_val::UUID;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Remove any existing policies on storage.objects for the documents bucket to avoid conflicts
DROP POLICY IF EXISTS "Read documents based on family member access" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- 4. Create SELECT Policy: Authenticated users can read if they are admin or have access to the family member
CREATE POLICY "Read documents based on family member access" 
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents' AND (
            public.is_admin(auth.uid()) OR
            public.has_member_access(auth.uid(), public.safe_uuid(split_part(name, '/', 1)))
        )
    );

-- 5. Create INSERT Policy: Only admins can upload files
CREATE POLICY "Admins can upload documents" 
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents' AND
        public.is_admin(auth.uid())
    );

-- 6. Create UPDATE Policy: Only admins can update files
CREATE POLICY "Admins can update documents" 
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'documents' AND
        public.is_admin(auth.uid())
    );

-- 7. Create DELETE Policy: Only admins can delete files
CREATE POLICY "Admins can delete documents" 
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents' AND
        public.is_admin(auth.uid())
    );
