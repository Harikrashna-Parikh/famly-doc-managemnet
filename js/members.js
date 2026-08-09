/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - MEMBERS & SETTINGS MODULE
   File: js/members.js
   ========================================================================== */

const members = {
    membersData: [],
    categoriesData: [],
    profilesData: [],

    /**
     * Load and render the full settings view.
     */
    async renderSettingsView() {
        if (!auth.isAdmin()) {
            utils.showToast("Settings are restricted to administrators.", "danger");
            app.navigate('/dashboard');
            return;
        }

        await Promise.all([
            this.loadAndRenderMembers(),
            this.loadAndRenderCategories(),
            this.loadAndRenderPermissions()
        ]);
    },

    // ============================================================
    // FAMILY MEMBERS CRUD
    // ============================================================

    /**
     * Load all family members and populate the members table.
     */
    async loadAndRenderMembers() {
        const tbody = document.getElementById("table-members-body");
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" class="loading-placeholder">Loading...</td></tr>';

        try {
            const { data, error } = await supabaseClient
                .from('family_members')
                .select('*')
                .order('name');

            if (error) throw error;
            this.membersData = data || [];

            if (this.membersData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="loading-placeholder">No family members yet.</td></tr>';
                return;
            }

            tbody.innerHTML = this.membersData.map(m => `
                <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.display_name || '—'}</td>
                    <td>
                        <span class="status-indicator ${m.is_active ? 'status-active' : 'status-inactive'}">
                            ${m.is_active ? '● Active' : '● Inactive'}
                        </span>
                    </td>
                    <td class="actions-col">
                        <button class="btn btn-outline btn-sm" onclick="members.showEditModal('${m.id}', '${m.name}', '${m.display_name || ''}')">Edit</button>
                        <button class="btn btn-outline btn-sm" onclick="members.toggleActive('${m.id}', ${m.is_active}, '${m.name}')">
                            ${m.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-sm" style="background-color:#fef2f2;color:#dc2626;border-color:#fca5a5;" onclick="members.deleteMember('${m.id}', '${m.name}')">Delete</button>
                    </td>
                </tr>
            `).join('');

        } catch (err) {
            console.error("Members load error:", err);
            tbody.innerHTML = '<tr><td colspan="4">Error loading members.</td></tr>';
        }
    },

    /**
     * Show the Add Member modal with clear form.
     */
    showAddModal() {
        const modal = document.getElementById("modal-member-form");
        const titleEl = document.getElementById("member-modal-title");
        const idInput = document.getElementById("member-id");
        const nameInput = document.getElementById("member-name");
        const displayInput = document.getElementById("member-display");

        if (!modal) return;

        if (titleEl) titleEl.textContent = "Add Family Member";
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (displayInput) displayInput.value = '';

        modal.classList.remove("hidden");
    },

    /**
     * Show the Edit Member modal pre-filled.
     */
    showEditModal(memberId, name, displayName) {
        const modal = document.getElementById("modal-member-form");
        const titleEl = document.getElementById("member-modal-title");
        const idInput = document.getElementById("member-id");
        const nameInput = document.getElementById("member-name");
        const displayInput = document.getElementById("member-display");

        if (!modal) return;

        if (titleEl) titleEl.textContent = "Edit Family Member";
        if (idInput) idInput.value = memberId;
        if (nameInput) nameInput.value = name;
        if (displayInput) displayInput.value = displayName;

        modal.classList.remove("hidden");
    },

    /**
     * Save a new or updated family member.
     */
    async saveMember(e) {
        e.preventDefault();

        const memberId = document.getElementById("member-id")?.value?.trim();
        const name = document.getElementById("member-name")?.value?.trim();
        const displayName = document.getElementById("member-display")?.value?.trim();

        if (!name) {
            utils.showToast("Member name is required.", "warning");
            return;
        }

        try {
            if (memberId) {
                // Update existing member
                const { error } = await supabaseClient
                    .from('family_members')
                    .update({ name, display_name: displayName || name })
                    .eq('id', memberId);

                if (error) throw error;
                utils.showToast(`"${name}" updated successfully.`, "success");
            } else {
                // Create new member
                const { error } = await supabaseClient
                    .from('family_members')
                    .insert({ name, display_name: displayName || name });

                if (error) throw error;
                utils.showToast(`Family member "${name}" added successfully.`, "success");
            }

            // Close modal and reload
            document.getElementById("modal-member-form")?.classList.add("hidden");
            await this.loadAndRenderMembers();
            await this.loadAndRenderPermissions();

        } catch (err) {
            console.error("Member save error:", err);
            utils.showToast(`Failed to save member: ${err.message}`, "danger");
        }
    },

    /**
     * Toggle a family member's active/inactive status.
     */
    async toggleActive(memberId, currentStatus, name) {
        const newStatus = !currentStatus;
        const action = newStatus ? 'activate' : 'deactivate';

        const confirmed = await utils.showConfirm(
            `${newStatus ? 'Activate' : 'Deactivate'} "${name}"?`,
            `This will ${action} the family member folder. Documents will remain intact.`,
            newStatus ? 'Activate' : 'Deactivate',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            const { error } = await supabaseClient
                .from('family_members')
                .update({ is_active: newStatus })
                .eq('id', memberId);

            if (error) throw error;
            utils.showToast(`"${name}" ${newStatus ? 'activated' : 'deactivated'}.`, "success");
            await this.loadAndRenderMembers();
        } catch (err) {
            console.error("Toggle active error:", err);
            utils.showToast("Failed to update member status.", "danger");
        }
    },

    /**
     * Permanently delete a family member (only if no documents attached, or admin confirms).
     */
    async deleteMember(memberId, name) {
        // Check for attached documents
        const { count } = await supabaseClient
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('family_member_id', memberId);

        let confirmMsg = 'This will permanently remove the family member folder.';
        if (count > 0) {
            confirmMsg = `⚠️ This member has ${count} document(s). Deleting will also permanently remove all associated documents from Storage. This cannot be undone.`;
        }

        const confirmed = await utils.showConfirm(
            `Delete "${name}"?`,
            confirmMsg,
            'Delete Permanently',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            // If documents exist, delete their storage files first
            if (count > 0) {
                const { data: docs } = await supabaseClient
                    .from('documents')
                    .select('storage_path')
                    .eq('family_member_id', memberId);

                if (docs && docs.length > 0) {
                    const paths = docs.map(d => d.storage_path);
                    await supabaseClient.storage.from('documents').remove(paths);
                }
            }

            // Delete the member (cascade deletes documents, member_access rows)
            const { error } = await supabaseClient
                .from('family_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;

            utils.showToast(`"${name}" deleted permanently.`, "success");
            await this.loadAndRenderMembers();
            await this.loadAndRenderPermissions();
        } catch (err) {
            console.error("Delete member error:", err);
            utils.showToast("Failed to delete family member.", "danger");
        }
    },

    // ============================================================
    // CATEGORIES CRUD
    // ============================================================

    /**
     * Load all categories and render in the settings table.
     */
    async loadAndRenderCategories() {
        const tbody = document.getElementById("table-categories-body");
        if (!tbody) return;

        try {
            const { data, error } = await supabaseClient
                .from('categories')
                .select('*')
                .order('name');

            if (error) throw error;
            this.categoriesData = data || [];

            tbody.innerHTML = this.categoriesData.map(c => `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.description || '—'}</td>
                    <td class="actions-col">
                        <button class="btn btn-sm" style="background-color:#fef2f2;color:#dc2626;border-color:#fca5a5;" 
                            onclick="members.deleteCategory('${c.id}', '${c.name}')">Delete</button>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="loading-placeholder">No categories found.</td></tr>';

        } catch (err) {
            console.error("Categories load error:", err);
            if (tbody) tbody.innerHTML = '<tr><td colspan="3">Error loading categories.</td></tr>';
        }
    },

    /**
     * Add a new document category.
     */
    async addCategory(e) {
        e.preventDefault();

        const name = document.getElementById("category-name")?.value?.trim();
        const desc = document.getElementById("category-desc")?.value?.trim();

        if (!name) {
            utils.showToast("Category name is required.", "warning");
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('categories')
                .insert({ name, description: desc || null });

            if (error) throw error;

            utils.showToast(`Category "${name}" created successfully.`, "success");
            document.getElementById("modal-category-form")?.classList.add("hidden");
            document.getElementById("category-form")?.reset();
            await this.loadAndRenderCategories();

        } catch (err) {
            console.error("Add category error:", err);
            utils.showToast(`Failed to add category: ${err.message}`, "danger");
        }
    },

    /**
     * Delete a category (only if no documents using it).
     */
    async deleteCategory(catId, catName) {
        const { count } = await supabaseClient
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', catId);

        if (count > 0) {
            utils.showToast(`Cannot delete "${catName}" — ${count} document(s) are using this category. Reassign them first.`, "warning");
            return;
        }

        const confirmed = await utils.showConfirm(`Delete category "${catName}"?`, 'This action cannot be undone.', 'Delete', 'Cancel');
        if (!confirmed) return;

        try {
            const { error } = await supabaseClient
                .from('categories')
                .delete()
                .eq('id', catId);

            if (error) throw error;
            utils.showToast(`Category "${catName}" deleted.`, "success");
            await this.loadAndRenderCategories();
        } catch (err) {
            utils.showToast("Failed to delete category.", "danger");
        }
    },

    // ============================================================
    // USER PERMISSIONS (MEMBER ACCESS)
    // ============================================================

    /**
     * Load all users, their roles, and their member access grants.
     */
    async loadAndRenderPermissions() {
        const tbody = document.getElementById("table-permissions-body");
        const userSelect = document.getElementById("perm-user");
        const memberSelect = document.getElementById("perm-member");

        try {
            const [profilesRes, accessRes, membersRes] = await Promise.all([
                supabaseClient.from('profiles').select('user_id, full_name, email, role, is_active').order('full_name'),
                supabaseClient.from('member_access').select('id, user_id, family_member_id, family_members(name, display_name)'),
                supabaseClient.from('family_members').select('id, name, display_name').eq('is_active', true).order('name')
            ]);

            this.profilesData = profilesRes.data || [];
            const accessData = accessRes.data || [];
            const allMembers = membersRes.data || [];

            // Populate Grant Access dropdowns
            if (userSelect) {
                userSelect.innerHTML = '<option value="" disabled selected>Select User...</option>' +
                    this.profilesData.map(p => `<option value="${p.user_id}">${p.full_name} (${p.email}) — ${p.role}</option>`).join('');
            }

            if (memberSelect) {
                memberSelect.innerHTML = '<option value="" disabled selected>Select Family Folder...</option>' +
                    allMembers.map(m => `<option value="${m.id}">${m.display_name || m.name}</option>`).join('');
            }

            // Build permissions table showing each user + what folders they can access
            if (tbody) {
                if (this.profilesData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="loading-placeholder">No registered users yet.</td></tr>';
                    return;
                }

                tbody.innerHTML = this.profilesData.map(profile => {
                    const userAccess = accessData.filter(a => a.user_id === profile.user_id);
                    const folderNames = profile.role === 'admin'
                        ? '<span class="badge" style="background:#d1fae5;color:#065f46;">All Folders (Admin)</span>'
                        : userAccess.length > 0
                            ? userAccess.map(a => `<span class="badge">${a.family_members?.display_name || a.family_members?.name || '—'}</span>`).join(' ')
                            : '<span style="color:var(--text-muted);font-size:0.85rem;">No access granted</span>';

                    const revokeButtons = userAccess.map(a => `
                        <button class="btn btn-sm" style="background-color:#fef2f2;color:#dc2626;border-color:#fca5a5;margin:2px;" 
                            onclick="members.revokeAccess('${a.id}', '${profile.full_name}')">
                            Revoke ${a.family_members?.display_name || a.family_members?.name || ''}
                        </button>
                    `).join('');

                    const roleEmoji = profile.role === 'admin' ? '👑' : '👤';
                    const roleBadgeStyle = profile.role === 'admin' ? 'background:#ede9fe;color:#6d28d9' : 'background:#e0e7ff;color:#4338ca';

                    return `
                        <tr>
                            <td>
                                <strong>${profile.full_name}</strong><br>
                                <span style="font-size:0.8rem;color:var(--text-muted);">${profile.email}</span>
                            </td>
                            <td>
                                <span class="badge" style="${roleBadgeStyle}">${roleEmoji} ${profile.role}</span>
                                ${profile.role !== 'admin' ? `
                                <button class="btn btn-sm btn-outline" style="margin-left:6px;font-size:0.75rem;" 
                                    onclick="members.promoteToAdmin('${profile.user_id}', '${profile.full_name}')">Make Admin</button>
                                ` : ''}
                            </td>
                            <td>${folderNames}</td>
                            <td class="actions-col">${profile.role === 'admin' ? '—' : revokeButtons}</td>
                        </tr>
                    `;
                }).join('');
            }

        } catch (err) {
            console.error("Permissions load error:", err);
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading permissions.</td></tr>';
        }
    },

    /**
     * Grant a user access to a specific family member's folder.
     */
    async grantAccess(e) {
        e.preventDefault();

        const userId = document.getElementById("perm-user")?.value;
        const memberId = document.getElementById("perm-member")?.value;

        if (!userId || !memberId) {
            utils.showToast("Please select both a user and a family folder.", "warning");
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('member_access')
                .insert({ user_id: userId, family_member_id: memberId });

            if (error) {
                if (error.code === '23505') {
                    utils.showToast("This user already has access to this folder.", "warning");
                } else {
                    throw error;
                }
                return;
            }

            utils.showToast("Access granted successfully.", "success");

            // Reset dropdowns
            document.getElementById("perm-user").value = '';
            document.getElementById("perm-member").value = '';

            await this.loadAndRenderPermissions();

        } catch (err) {
            console.error("Grant access error:", err);
            utils.showToast("Failed to grant access.", "danger");
        }
    },

    /**
     * Revoke an existing access mapping.
     */
    async revokeAccess(accessId, userName) {
        const confirmed = await utils.showConfirm(
            'Revoke Access?',
            `This will remove the folder access for ${userName}.`,
            'Revoke',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            const { error } = await supabaseClient
                .from('member_access')
                .delete()
                .eq('id', accessId);

            if (error) throw error;
            utils.showToast("Access revoked.", "success");
            await this.loadAndRenderPermissions();
        } catch (err) {
            utils.showToast("Failed to revoke access.", "danger");
        }
    },

    /**
     * Promote a member-role user to admin (admin-only action).
     */
    async promoteToAdmin(userId, userName) {
        const confirmed = await utils.showConfirm(
            `Promote "${userName}" to Admin?`,
            'Admins have full access to all folders, documents, and settings. This cannot be automatically undone.',
            'Promote to Admin',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ role: 'admin' })
                .eq('user_id', userId);

            if (error) throw error;
            utils.showToast(`"${userName}" promoted to Admin successfully.`, "success");
            await this.loadAndRenderPermissions();
        } catch (err) {
            console.error("Promote admin error:", err);
            utils.showToast("Failed to promote user to admin.", "danger");
        }
    }
};
