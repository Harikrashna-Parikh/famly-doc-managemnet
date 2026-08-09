/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - DASHBOARD MODULE
   File: js/dashboard.js
   ========================================================================== */

const dashboard = {
    familyMembers: [],

    /**
     * Load and render the dashboard view for admin or member.
     */
    async render() {
        const welcomeEl = document.getElementById("dashboard-welcome");
        const gridEl = document.getElementById("family-members-grid");
        const countEl = document.getElementById("member-folders-count");

        if (!gridEl) return;

        // Personalize welcome message
        if (welcomeEl && auth.currentProfile) {
            const name = auth.currentProfile.full_name || auth.currentProfile.email;
            welcomeEl.textContent = `Welcome, ${name}`;
        }

        gridEl.innerHTML = '<div class="loading-placeholder">🔒 Loading family member folders...</div>';

        try {
            let members = [];

            if (auth.isAdmin()) {
                // Admin: fetch all active family members
                const { data, error } = await supabaseClient
                    .from('family_members')
                    .select(`
                        *,
                        documents(count)
                    `)
                    .order('name');
                if (error) throw error;
                members = data || [];

                // Render stats bar
                await this.renderStats(members);
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                // Member: fetch only authorized family members via member_access
                const { data, error } = await supabaseClient
                    .from('member_access')
                    .select(`
                        family_member_id,
                        family_members!inner(
                            id, name, display_name, is_active
                        )
                    `)
                    .eq('user_id', auth.currentUser.id);

                if (error) throw error;

                members = (data || [])
                    .map(m => m.family_members)
                    .filter(m => m.is_active);
            }

            this.familyMembers = members;

            if (countEl) {
                countEl.textContent = `${members.length} Folder${members.length !== 1 ? 's' : ''}`;
            }

            if (members.length === 0) {
                gridEl.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-state-icon">📂</span>
                        <p>${auth.isAdmin() ? 'No family members yet. Add the first member from Settings.' : 'No authorized folders yet. Contact Admin to get access.'}</p>
                        ${auth.isAdmin() ? `<a href="#/settings" class="btn btn-primary" style="margin-top:16px;">Go to Settings</a>` : ''}
                    </div>
                `;
                return;
            }

            gridEl.innerHTML = members.map(member => this.buildMemberCard(member)).join('');

        } catch (err) {
            console.error("Dashboard load error:", err);
            gridEl.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>Unable to load family folders. Please try again.</p></div>`;
            utils.showToast("Failed to load family member folders.", "danger");
        }
    },

    /**
     * Load aggregate statistics for admin dashboard.
     */
    async renderStats(members) {
        try {
            const { count: docsCount } = await supabaseClient
                .from('documents')
                .select('*', { count: 'exact', head: true });

            const { data: sizeData } = await supabaseClient
                .from('documents')
                .select('file_size');

            const totalSize = (sizeData || []).reduce((sum, d) => sum + (d.file_size || 0), 0);

            const statMembersEl = document.getElementById("stat-members-count");
            const statDocsEl = document.getElementById("stat-docs-count");
            const statStorageEl = document.getElementById("stat-storage-size");

            if (statMembersEl) statMembersEl.textContent = members.filter(m => m.is_active).length;
            if (statDocsEl) statDocsEl.textContent = docsCount || 0;
            if (statStorageEl) statStorageEl.textContent = utils.formatBytes(totalSize);

        } catch (err) {
            console.warn("Stats load error:", err);
        }
    },

    /**
     * Build HTML for a family member card.
     */
    buildMemberCard(member) {
        const docCount = member.documents ? member.documents[0]?.count || 0 : '—';
        const displayName = member.display_name || member.name;
        const isInactive = !member.is_active;

        return `
            <div class="family-card ${isInactive ? 'card-inactive' : ''}" 
                 onclick="if (!event.target.closest('.btn')) app.navigate('/member/${member.id}')">
                <div class="family-card-header">
                    <div class="family-card-title">${displayName}</div>
                    ${isInactive ? '<span class="status-indicator status-inactive">Inactive</span>' : ''}
                </div>
                <div class="family-card-body">
                    <p class="doc-count">
                        <span class="doc-count-num">${docCount}</span>
                        ${typeof docCount === 'number' ? `Document${docCount !== 1 ? 's' : ''}` : 'Documents'}
                    </p>
                </div>
                <div class="family-card-footer">
                    <a href="#/member/${member.id}" class="btn btn-primary" 
                       onclick="event.stopPropagation()">Open Folder</a>
                    ${auth.isAdmin() ? `
                        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); members.showEditModal('${member.id}', '${member.name}', '${member.display_name || ''}')">Edit</button>
                    ` : ''}
                </div>
            </div>
        `;
    }
};
