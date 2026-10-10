/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - SUPABASE CLIENT
   File: js/supabase.js
   ========================================================================== */

// 1. Supabase credentials — injected by GitHub Actions at deploy time.
// Do NOT hardcode real values here. Add them as GitHub Secrets instead.
const SUPABASE_URL = "__SUPABASE_URL__";
const SUPABASE_PUBLISHABLE_KEY = "__SUPABASE_PUBLISHABLE_KEY__";

let supabaseClient = null;

// 2. Helper to verify if credentials are configured
function isSupabaseConfigured() {
    return (
        SUPABASE_URL && 
        !SUPABASE_URL.startsWith("__") && 
        SUPABASE_URL !== "YOUR_SUPABASE_URL" && 
        SUPABASE_PUBLISHABLE_KEY && 
        !SUPABASE_PUBLISHABLE_KEY.startsWith("__") && 
        SUPABASE_PUBLISHABLE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY"
    );
}

// 3. Initialize Supabase client
if (isSupabaseConfigured()) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
    }
} else {
    // Show setup view if keys are default placeholders
    document.addEventListener("DOMContentLoaded", () => {
        const setupView = document.getElementById("setup-view");
        const appContainer = document.getElementById("app-container");
        const loginView = document.getElementById("login-view");
        
        if (setupView) setupView.classList.remove("hidden");
        if (appContainer) appContainer.classList.add("hidden");
        if (loginView) loginView.classList.add("hidden");
    });
}
