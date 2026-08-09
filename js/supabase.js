/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - SUPABASE CLIENT
   File: js/supabase.js
   ========================================================================== */

// 1. Supabase credentials placeholders
// Replace these with your actual Supabase URL and Publishable (anon) API Key
const SUPABASE_URL = "https://ijmnpqzrskmouxvvhdbf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbW5wcXpyc2ttb3V4dnZoZGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyODgxNjQsImV4cCI6MjEwMTg2NDE2NH0.dKEuFzN-LgTmRWHTIZcA_Mk71wWx_6OFGidOJMHMmkQ";

let supabaseClient = null;

// 2. Helper to verify if credentials are configured
function isSupabaseConfigured() {
    return (
        SUPABASE_URL && 
        SUPABASE_URL !== "YOUR_SUPABASE_URL" && 
        SUPABASE_PUBLISHABLE_KEY && 
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
