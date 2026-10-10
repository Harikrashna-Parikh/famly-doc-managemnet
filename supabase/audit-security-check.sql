-- ============================================================================
-- FAMILY DIGITAL DOCUMENT LOCKER - SECURITY & INTEGRITY AUDIT SCRIPT
-- File: supabase/audit-security-check.sql
-- 
-- Run these queries in the Supabase SQL Editor to check for any unauthorized
-- users, malicious file uploads, tampering, or orphaned data.
-- ============================================================================


-- ============================================================================
-- SECTION 1: AUTH & PROFILE AUDIT
-- Check for unrecognized users, unauthorized admins, or unexpected sign-ups
-- ============================================================================

-- 1.1 List all registered users with their roles and creation dates
-- Review the list to confirm all email addresses belong to legitimate family members.
SELECT 
    u.id AS auth_user_id,
    u.email,
    p.full_name,
    p.role,
    p.is_active,
    u.created_at AS auth_created_at,
    u.last_sign_in_at,
    u.raw_user_meta_data
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ORDER BY u.created_at DESC;

-- 1.2 Check specifically for any users who have the 'admin' role
-- ALERT: If there is more than 1 admin, or an admin email you do not recognize!
SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.email,
    p.role,
    p.is_active,
    p.created_at
FROM public.profiles p
WHERE p.role = 'admin';

-- 1.3 Check for users created in auth.users that do not have a public profile (or vice versa)
SELECT 
    'auth.users without profile' AS issue_type,
    u.id AS user_id,
    u.email,
    u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL

UNION ALL

SELECT 
    'profile without auth.users' AS issue_type,
    p.user_id,
    p.email,
    p.created_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL;

-- 1.4 Check recent Supabase Auth audit logs (if accessible in your plan)
-- Look for unexpected IPs, unknown user creations, or unusual sign-ins.
SELECT 
    id,
    created_at,
    ip_address,
    action,
    actor_username,
    payload
FROM auth.audit_log_entries
ORDER BY created_at DESC
LIMIT 50;


-- ============================================================================
-- SECTION 2: STORAGE OBJECTS AUDIT
-- Check storage.objects for malicious file extensions, spoofed MIME types,
-- or orphaned uploads not recorded in the documents table.
-- ============================================================================

-- 2.1 Check for files with suspicious or executable extensions
-- Allowed types are: jpg, jpeg, png, webp, pdf
SELECT 
    id,
    bucket_id,
    name AS file_path,
    owner,
    created_at,
    (metadata->>'size')::bigint AS file_size_bytes,
    metadata->>'mimetype' AS mime_type
FROM storage.objects
WHERE bucket_id = 'documents'
  AND (
      -- Flag non-allowed file extensions
      LOWER(name) NOT SIMILAR TO '%.(jpg|jpeg|png|webp|pdf)'
      OR LOWER(name) SIMILAR TO '%.(exe|bat|cmd|sh|php|phtml|js|vbs|scr|html|htm|svg|jar|apk|bin|dll|cgi|pl|py|ps1)'
  );

-- 2.2 Check for suspicious MIME types in storage
-- The bucket only permits jpeg, png, webp, pdf
SELECT 
    id,
    name AS file_path,
    metadata->>'mimetype' AS mime_type,
    (metadata->>'size')::bigint AS file_size_bytes,
    owner,
    created_at
FROM storage.objects
WHERE bucket_id = 'documents'
  AND metadata->>'mimetype' NOT IN (
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf'
  );

-- 2.3 Detect ORPHANED storage objects
-- Files uploaded to storage that have NO matching entry in public.documents
-- (Indicates direct upload via API bypassing application UI)
SELECT 
    so.id,
    so.bucket_id,
    so.name AS storage_file_path,
    so.metadata->>'mimetype' AS mime_type,
    (so.metadata->>'size')::bigint AS file_size,
    so.owner,
    so.created_at
FROM storage.objects so
LEFT JOIN public.documents d ON d.storage_path = so.name
WHERE so.bucket_id = 'documents'
  AND d.id IS NULL;


-- ============================================================================
-- SECTION 3: DOCUMENTS TABLE AUDIT
-- Check public.documents for anomalous entries, XSS/script injection payloads,
-- or references to missing storage files.
-- ============================================================================

-- 3.1 Check for potential XSS, script injection, or SQLi strings in documents
SELECT 
    id,
    name,
    file_name,
    description,
    storage_path,
    created_by,
    created_at
FROM public.documents
WHERE 
    -- Check for common injection patterns
    name ~* '(<script|javascript:|onerror=|onload=|eval\(|<iframe|<img|<svg)'
    OR description ~* '(<script|javascript:|onerror=|onload=|eval\(|<iframe|<img|<svg)'
    OR file_name ~* '(<script|javascript:|onerror=|onload=|\.exe|\.sh|\.php|\.js|\.bat|\.html)'
    OR storage_path ~* '(<script|\.\./)';

-- 3.2 Detect ghost document records (records pointing to storage files that don't exist)
SELECT 
    d.id,
    d.name,
    d.file_name,
    d.storage_path,
    d.created_at,
    d.created_by
FROM public.documents d
LEFT JOIN storage.objects so ON so.name = d.storage_path AND so.bucket_id = 'documents'
WHERE so.id IS NULL;

-- 3.3 List all documents with their uploader details for manual verification
SELECT 
    d.id,
    d.name,
    d.file_name,
    d.file_type,
    ROUND(d.file_size / 1024.0 / 1024.0, 2) AS size_mb,
    c.name AS category,
    fm.name AS family_member,
    p.email AS uploader_email,
    d.created_at
FROM public.documents d
LEFT JOIN public.categories c ON c.id = d.category_id
LEFT JOIN public.family_members fm ON fm.id = d.family_member_id
LEFT JOIN public.profiles p ON p.user_id = d.created_by
ORDER BY d.created_at DESC;


-- ============================================================================
-- SECTION 4: ACCESS CONTROL & DATA TAMPERING AUDIT
-- Check for unexpected family members, altered categories, or unauthorized access
-- ============================================================================

-- 4.1 Check all member access permissions granted
SELECT 
    ma.id,
    p.email AS user_email,
    p.role AS user_role,
    fm.name AS granted_family_member,
    ma.created_at
FROM public.member_access ma
JOIN public.profiles p ON p.user_id = ma.user_id
JOIN public.family_members fm ON fm.id = ma.family_member_id
ORDER BY ma.created_at DESC;

-- 4.2 Check for unexpected or suspicious family members
SELECT 
    id,
    name,
    display_name,
    is_active,
    created_at,
    updated_at
FROM public.family_members
ORDER BY created_at DESC;

-- 4.3 Check for any unexpected categories
SELECT 
    id,
    name,
    description,
    created_at
FROM public.categories
ORDER BY created_at ASC;


-- ============================================================================
-- SECTION 5: SECURITY SUMMARY DASHBOARD (SINGLE QUERY)
-- Run this single query for an instant security posture check.
-- If all "anomalies" are 0, your database is clean.
-- ============================================================================
SELECT 
    (SELECT COUNT(*) FROM auth.users) AS total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') AS total_admins,
    (SELECT COUNT(*) FROM public.documents) AS total_documents,
    (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'documents') AS total_storage_files,
    -- Anomalies:
    (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'documents' AND LOWER(name) NOT SIMILAR TO '%.(jpg|jpeg|png|webp|pdf)') AS suspicious_storage_extensions,
    (SELECT COUNT(*) FROM storage.objects so LEFT JOIN public.documents d ON d.storage_path = so.name WHERE so.bucket_id = 'documents' AND d.id IS NULL) AS orphaned_storage_files,
    (SELECT COUNT(*) FROM public.documents WHERE name ~* '(<script|javascript:|onerror=)' OR description ~* '(<script|javascript:|onerror=)') AS injection_payloads_in_documents;
