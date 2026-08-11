/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - MAIN APP ROUTER & CONTROLLER
   File: js/app.js
   ========================================================================== */

const app = {
    currentRoute: null,

    /**
     * Bootstrap the entire application.
     */
    init() {
        if (!supabaseClient) return; // Setup view is already shown by supabaseClient.js

        // Monitor online/offline status
        this.initConnectivityMonitor();

        // Initialize auth state listener
        auth.initAuth((user, profile) => {
            if (user && profile) {
                this.onAuthenticated(profile);
            } else if (!user) {
                this.onUnauthenticated();
            }
        });

        // Listen for hash-based route changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Bind global UI event listeners
        this.bindEvents();
    },

    /**
     * Called when user is authenticated. Show app shell and route to current hash.
     */
    onAuthenticated(profile) {
        // Show app container, hide login
        document.getElementById("app-container")?.classList.remove("hidden");
        document.getElementById("login-view")?.classList.add("hidden");

        // Populate header user info
        const nameEl = document.getElementById("user-display-name");
        const badgeEl = document.getElementById("user-role-badge");
        if (nameEl) nameEl.textContent = profile.full_name || profile.email;
        if (badgeEl) {
            badgeEl.textContent = profile.role === 'admin' ? '👑 Admin' : '👤 Member';
            badgeEl.style.backgroundColor = profile.role === 'admin' ? '#ede9fe' : '#e0e7ff';
            badgeEl.style.color = profile.role === 'admin' ? '#6d28d9' : '#4338ca';
        }

        // Show/hide admin-only nav items
        if (profile.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        }

        // Route to the appropriate view
        const hash = window.location.hash || '#/dashboard';
        window.location.hash = hash;
        this.handleRoute();
    },

    /**
     * Called when user is not authenticated. Show login screen.
     */
    onUnauthenticated() {
        document.getElementById("app-container")?.classList.add("hidden");
        document.getElementById("login-view")?.classList.remove("hidden");

        this.showLoginTab();
    },

    /**
     * Handle hash-based routing.
     */
    handleRoute() {
        if (!auth.currentUser) return;

        const hash = window.location.hash || '#/dashboard';
        const route = hash.replace('#', '');

        this.currentRoute = route;

        // Hide all views
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));

        // Update active nav item (sidebar)
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        // Update active bottom nav tab (mobile)
        document.querySelectorAll('#mobile-bottom-nav .nav-tab').forEach(t => t.classList.remove('active'));

        if (route === '/dashboard' || route === '/') {
            this.showView('view-dashboard');
            document.getElementById("nav-dashboard")?.classList.add('active');
            document.getElementById("m-nav-dashboard")?.classList.add('active');
            dashboard.render();
        }
        else if (route.startsWith('/member/')) {
            const memberId = route.replace('/member/', '');
            this.showView('view-member');
            document.getElementById("nav-dashboard")?.classList.add('active');
            document.getElementById("m-nav-dashboard")?.classList.add('active');
            documents.renderMemberView(memberId);
        }
        else if (route === '/upload') {
            if (!auth.isAdmin()) { this.navigate('/dashboard'); return; }
            this.showView('view-upload');
            document.getElementById("nav-upload")?.classList.add('active');
            document.getElementById("m-nav-upload")?.classList.add('active');
            upload.renderUploadView();
        }
        else if (route === '/settings') {
            if (!auth.isAdmin()) { this.navigate('/dashboard'); return; }
            this.showView('view-settings');
            document.getElementById("nav-settings")?.classList.add('active');
            document.getElementById("m-nav-settings")?.classList.add('active');
            members.renderSettingsView();
        }
        else {
            // Unknown route → redirect to dashboard
            this.navigate('/dashboard');
        }
    },

    /**
     * Navigate to a route programmatically.
     */
    navigate(route) {
        window.location.hash = '#' + route;
    },

    /**
     * Show a specific view by its ID.
     */
    showView(viewId) {
        document.getElementById(viewId)?.classList.remove('hidden');
    },

    /**
     * Bind all global UI events (forms, modals, auth tabs, etc.).
     */
    bindEvents() {
        // ── Auth: Login Form ──
        const loginForm = document.getElementById("login-form");
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById("login-email").value;
                const password = document.getElementById("login-password").value;
                const btnText = document.getElementById("login-btn-text");
                const loadingIcon = document.getElementById("login-loading-icon");

                if (btnText) btnText.textContent = 'Logging in...';
                if (loadingIcon) loadingIcon.classList.remove('hidden');

                try {
                    await auth.login(email, password);
                } catch (err) {
                    console.error("Login error:", err);
                    const msg = err.message?.includes('Invalid login credentials')
                        ? 'Incorrect email or password.'
                        : err.message || 'Login failed. Please try again.';
                    utils.showToast(msg, "danger");
                } finally {
                    if (btnText) btnText.textContent = 'Login';
                    if (loadingIcon) loadingIcon.classList.add('hidden');
                }
            });
        }

        // ── Auth: Signup Form ──
        const signupForm = document.getElementById("signup-form");
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById("signup-name").value.trim();
                const email = document.getElementById("signup-email").value;
                const password = document.getElementById("signup-password").value;
                const btnText = document.getElementById("signup-btn-text");
                const loadingIcon = document.getElementById("signup-loading-icon");

                if (!name) { utils.showToast("Full name is required.", "warning"); return; }
                if (password.length < 6) { utils.showToast("Password must be at least 6 characters.", "warning"); return; }

                if (btnText) btnText.textContent = 'Registering...';
                if (loadingIcon) loadingIcon.classList.remove('hidden');

                try {
                    const { data } = await auth.signup(email, password, name);
                    if (data?.user?.identities?.length === 0) {
                        utils.showToast("This email is already registered. Please login instead.", "warning");
                    } else {
                        utils.showToast("Account created! Logging you in...", "success");
                    }
                } catch (err) {
                    console.error("Signup error:", err);
                    utils.showToast(err.message || 'Registration failed. Please try again.', "danger");
                } finally {
                    if (btnText) btnText.textContent = 'Register Account';
                    if (loadingIcon) loadingIcon.classList.add('hidden');
                }
            });
        }

        // ── Auth: Password Visibility Toggles ──
        document.querySelectorAll('.btn-toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;

                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';

                const eyeIcon = btn.querySelector('.icon-eye');
                const eyeOffIcon = btn.querySelector('.icon-eye-off');
                if (eyeIcon && eyeOffIcon) {
                    eyeIcon.classList.toggle('hidden', isPassword);
                    eyeOffIcon.classList.toggle('hidden', !isPassword);
                }
            });
        });

        // ── Auth: Tab switches ──
        document.getElementById("tab-login-btn")?.addEventListener('click', () => this.showLoginTab());
        document.getElementById("tab-signup-btn")?.addEventListener('click', () => this.showSignupTab());

        // ── Auth: Forgot password ──
        document.getElementById("link-forgot-password")?.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            if (!email) {
                utils.showToast("Enter your email address first, then click Forgot Password.", "warning");
                return;
            }
            try {
                await auth.forgotPassword(email);
                utils.showToast("Password reset link sent! Check your email inbox.", "success");
            } catch (err) {
                utils.showToast(err.message || "Failed to send reset email.", "danger");
            }
        });

        // ── Auth: Logout button ──
        document.getElementById("btn-logout")?.addEventListener('click', async () => {
            await auth.logout();
        });

        // ── Document Viewer: Close button ──
        document.getElementById("btn-close-viewer")?.addEventListener('click', () => documents.closeViewer());

        // Close modal when clicking backdrop
        document.querySelector('#modal-doc-viewer .modal-backdrop')?.addEventListener('click', () => documents.closeViewer());

        // ── Member Modal: Close & Submit ──
        document.getElementById("btn-show-add-member")?.addEventListener('click', () => members.showAddModal());
        document.getElementById("btn-close-member-modal")?.addEventListener('click', () => {
            document.getElementById("modal-member-form")?.classList.add("hidden");
        });
        document.getElementById("btn-cancel-member-modal")?.addEventListener('click', () => {
            document.getElementById("modal-member-form")?.classList.add("hidden");
        });
        document.getElementById("member-form")?.addEventListener('submit', (e) => members.saveMember(e));

        // Close member modal on backdrop click
        document.querySelector('#modal-member-form .modal-backdrop')?.addEventListener('click', () => {
            document.getElementById("modal-member-form")?.classList.add("hidden");
        });

        // ── Category Modal: Close & Submit ──
        document.getElementById("btn-show-add-category")?.addEventListener('click', () => {
            document.getElementById("modal-category-form")?.classList.remove("hidden");
        });
        document.getElementById("btn-close-category-modal")?.addEventListener('click', () => {
            document.getElementById("modal-category-form")?.classList.add("hidden");
        });
        document.getElementById("btn-cancel-category-modal")?.addEventListener('click', () => {
            document.getElementById("modal-category-form")?.classList.add("hidden");
        });
        document.getElementById("category-form")?.addEventListener('submit', (e) => members.addCategory(e));

        document.querySelector('#modal-category-form .modal-backdrop')?.addEventListener('click', () => {
            document.getElementById("modal-category-form")?.classList.add("hidden");
        });

        // ── Upload Form ──
        document.getElementById("upload-form")?.addEventListener('submit', (e) => upload.handleUploadSubmit(e));

        // ── Grant Permission Form ──
        document.getElementById("permission-form")?.addEventListener('submit', (e) => members.grantAccess(e));

        // ── Document Search Input ──
        document.getElementById("doc-search-input")?.addEventListener('input', (e) => {
            documents.handleSearch(e.target.value);
        });

        // ── Close Confirm Modal on backdrop ──
        document.querySelector('#modal-confirm .modal-backdrop')?.addEventListener('click', () => {
            document.getElementById("modal-confirm")?.classList.add("hidden");
        });

        // ── Close Share Modal ──
        document.getElementById("btn-close-share-modal")?.addEventListener('click', () => {
            document.getElementById("modal-doc-share")?.classList.add("hidden");
        });
        document.getElementById("share-modal-backdrop")?.addEventListener('click', () => {
            document.getElementById("modal-doc-share")?.classList.add("hidden");
        });

        // ── Close Download Options Modal ──
        document.getElementById("btn-close-download-options-modal")?.addEventListener('click', () => {
            document.getElementById("modal-doc-download-options")?.classList.add("hidden");
        });
        document.getElementById("download-options-modal-backdrop")?.addEventListener('click', () => {
            document.getElementById("modal-doc-download-options")?.classList.add("hidden");
        });
        document.getElementById("btn-download-options-cancel")?.addEventListener('click', () => {
            document.getElementById("modal-doc-download-options")?.classList.add("hidden");
        });

        // ── Theme Toggle Button ──
        const themeToggleBtn = document.getElementById("btn-theme-toggle");
        if (themeToggleBtn) {
            const updateThemeIcons = () => {
                const isDark = document.documentElement.classList.contains('dark-theme') || 
                               (!document.documentElement.classList.contains('light-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
                const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
                const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');
                if (sunIcon && moonIcon) {
                    if (isDark) {
                        sunIcon.classList.remove('hidden');
                        moonIcon.classList.add('hidden');
                    } else {
                        sunIcon.classList.add('hidden');
                        moonIcon.classList.remove('hidden');
                    }
                }
            };

            // Initial icon sync
            updateThemeIcons();

            themeToggleBtn.addEventListener('click', () => {
                const doc = document.documentElement;
                if (doc.classList.contains('dark-theme')) {
                    doc.classList.remove('dark-theme');
                    doc.classList.add('light-theme');
                    localStorage.setItem('theme', 'light');
                } else if (doc.classList.contains('light-theme')) {
                    doc.classList.remove('light-theme');
                    doc.classList.add('dark-theme');
                    localStorage.setItem('theme', 'dark');
                } else {
                    // System default active, toggle to opposite of current system scheme
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                        doc.classList.add('light-theme');
                        localStorage.setItem('theme', 'light');
                    } else {
                        doc.classList.add('dark-theme');
                        localStorage.setItem('theme', 'dark');
                    }
                }
                updateThemeIcons();
            });
        }

        // ── Mobile Bottom Nav Tabs ──
        document.querySelectorAll('#mobile-bottom-nav .nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const route = tab.getAttribute('data-route');
                if (route) this.navigate(route);
            });
        });

        // ── Keyboard: Escape to close modals ──
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
            }
        });
    },

    /**
     * Show the login tab.
     */
    showLoginTab() {
        document.getElementById("login-form")?.classList.remove('hidden');
        document.getElementById("signup-form")?.classList.add('hidden');
        document.getElementById("tab-login-btn")?.classList.add('active');
        document.getElementById("tab-signup-btn")?.classList.remove('active');
    },

    /**
     * Show the registration tab.
     */
    showSignupTab() {
        document.getElementById("signup-form")?.classList.remove('hidden');
        document.getElementById("login-form")?.classList.add('hidden');
        document.getElementById("tab-signup-btn")?.classList.add('active');
        document.getElementById("tab-login-btn")?.classList.remove('active');
    },

    /**
     * Monitor browser online/offline events and show banner.
     */
    initConnectivityMonitor() {
        const banner = document.getElementById("offline-banner");
        if (!banner) return;

        const update = () => {
            if (!navigator.onLine) {
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        };

        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        update(); // initial check
    }
};

// Bootstrap the app once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
