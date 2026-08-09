/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - AUTHENTICATION SERVICES
   File: js/auth.js
   ========================================================================== */

const auth = {
    currentUser: null,
    currentProfile: null,

    /**
     * Set up auth state change listeners and load active profile.
     * @param {Function} onStateChanged - Callback when session changes.
     */
    initAuth(onStateChanged) {
        if (!supabaseClient) return;

        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth event triggered:", event, session ? "Session active" : "No session");
            
            if (session) {
                this.currentUser = session.user;
                // Fetch profile with retry policy to allow trigger execution time
                const profile = await this.fetchUserProfile(session.user.id);
                
                if (profile) {
                    if (!profile.is_active) {
                        utils.showToast("Your account has been deactivated. Contact Admin.", "danger");
                        await this.logout();
                        return;
                    }
                    this.currentProfile = profile;
                } else {
                    utils.showToast("Could not retrieve user profile details.", "warning");
                    this.currentProfile = {
                        user_id: session.user.id,
                        full_name: session.user.email.split('@')[0],
                        email: session.user.email,
                        role: 'member',
                        is_active: true
                    };
                }
            } else {
                this.currentUser = null;
                this.currentProfile = null;
            }
            
            onStateChanged(this.currentUser, this.currentProfile);
        });
    },

    /**
     * Retrieve user profile with retry loops to wait for DB triggers.
     * @param {string} userId - Auth user UID.
     * @param {number} retries - Retry attempts.
     */
    async fetchUserProfile(userId, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (data) return data;
                if (error) throw error;
                
                // Wait briefly before retrying
                await new Promise(resolve => setTimeout(resolve, 600));
            } catch (err) {
                console.warn(`Profile load retry ${i + 1}/3 failed:`, err);
            }
        }
        return null;
    },

    /**
     * Authenticate via email/password.
     */
    async login(email, password) {
        if (!supabaseClient) throw new Error("supabaseClient is not initialized.");
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) throw error;
        return data;
    },

    /**
     * Register a new member/admin account.
     */
    async signup(email, password, fullName) {
        if (!supabaseClient) throw new Error("supabaseClient is not initialized.");

        const { data, error } = await supabaseClient.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    full_name: fullName.trim()
                }
            }
        });

        if (error) throw error;
        return data;
    },

    /**
     * Sign out and clear session tokens.
     */
    async logout() {
        if (!supabaseClient) return;
        const { error } = await supabaseClient.auth.signOut();
        if (error) console.error("Error signing out:", error.message);
        
        // Hard redirection to clear hash routes and memories
        window.location.hash = "#/login";
    },

    /**
     * Request a password reset link.
     */
    async forgotPassword(email) {
        if (!supabaseClient) throw new Error("supabaseClient is not initialized.");
        
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin + window.location.pathname
        });

        if (error) throw error;
        return data;
    },

    /**
     * Check if the authenticated user has Admin permissions.
     */
    isAdmin() {
        return this.currentProfile && this.currentProfile.role === 'admin';
    },

    /**
     * Check if the authenticated user account is active.
     */
    isActive() {
        return this.currentProfile && this.currentProfile.is_active === true;
    }
};
