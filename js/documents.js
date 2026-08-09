/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - DOCUMENTS MODULE
   File: js/documents.js
   ========================================================================== */

const documents = {
    currentMemberId: null,
    currentMemberName: null,
    allDocs: [],
    activeCategory: 'all',

    /**
     * Load and render all documents for a family member.
     * @param {string} memberId - family_members.id UUID.
     */
    async renderMemberView(memberId) {
        this.currentMemberId = memberId;
        this.activeCategory = 'all';

        const container = document.getElementById("documents-container");
        const titleEl = document.getElementById("member-folder-title");
        const subtitleEl = document.getElementById("member-folder-subtitle");
        const searchInput = document.getElementById("doc-search-input");

        if (!container) return;

        container.innerHTML = '<div class="loading-placeholder">🔒 Loading secure folder...</div>';

        // Reset search
        if (searchInput) searchInput.value = '';

        try {
            // Fetch member info
            const { data: member, error: memberErr } = await supabaseClient
                .from('family_members')
                .select('name, display_name')
                .eq('id', memberId)
                .maybeSingle();

            if (memberErr) throw memberErr;
            if (!member) {
                container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🚫</span><p>Family member folder not found or access denied.</p></div>`;
                return;
            }

            this.currentMemberName = member.display_name || member.name;
            if (titleEl) titleEl.textContent = `${this.currentMemberName}'s Documents`;
            if (subtitleEl) subtitleEl.textContent = `Browse and manage secure documents.`;

            // Fetch documents with category details
            const { data: docs, error: docsErr } = await supabaseClient
                .from('documents')
                .select(`
                    *,
                    categories(id, name)
                `)
                .eq('family_member_id', memberId)
                .order('name');

            if (docsErr) throw docsErr;

            this.allDocs = docs || [];

            // Build category filter tabs
            this.buildCategoryTabs();

            // Render the document list
            this.renderDocList(this.allDocs);

        } catch (err) {
            console.error("Member documents load error:", err);
            container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>Unable to load documents. Please try again.</p></div>`;
            utils.showToast("Failed to load documents.", "danger");
        }
    },

    /**
     * Build the horizontal category filter tabs.
     */
    buildCategoryTabs() {
        const tabsContainer = document.getElementById("doc-category-tabs");
        if (!tabsContainer) return;

        const categoriesMap = {};
        this.allDocs.forEach(doc => {
            if (doc.categories) {
                categoriesMap[doc.categories.id] = doc.categories.name;
            }
        });

        let tabsHTML = `<button class="category-tab active" data-cat="all" onclick="documents.filterByCategory('all', this)">All Documents (${this.allDocs.length})</button>`;

        Object.entries(categoriesMap).forEach(([id, name]) => {
            const count = this.allDocs.filter(d => d.category_id === id).length;
            tabsHTML += `<button class="category-tab" data-cat="${id}" onclick="documents.filterByCategory('${id}', this)">${name} (${count})</button>`;
        });

        tabsContainer.innerHTML = tabsHTML;
    },

    /**
     * Filter documents by category and re-render.
     */
    filterByCategory(catId, clickedEl) {
        this.activeCategory = catId;

        // Update active tab state
        document.querySelectorAll('.category-tab').forEach(el => el.classList.remove('active'));
        if (clickedEl) clickedEl.classList.add('active');

        const searchInput = document.getElementById("doc-search-input");
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        let filtered = this.allDocs;
        if (catId !== 'all') {
            filtered = filtered.filter(d => d.category_id === catId);
        }
        if (query) {
            filtered = filtered.filter(d =>
                d.name.toLowerCase().includes(query) ||
                (d.categories && d.categories.name.toLowerCase().includes(query)) ||
                (d.description && d.description.toLowerCase().includes(query))
            );
        }

        this.renderDocList(filtered);
    },

    /**
     * Handle search input event.
     */
    handleSearch(query) {
        query = query.toLowerCase().trim();

        let filtered = this.allDocs;

        if (this.activeCategory !== 'all') {
            filtered = filtered.filter(d => d.category_id === this.activeCategory);
        }

        if (query) {
            filtered = filtered.filter(d =>
                d.name.toLowerCase().includes(query) ||
                (d.categories && d.categories.name.toLowerCase().includes(query)) ||
                (d.description && d.description.toLowerCase().includes(query))
            );
        }

        this.renderDocList(filtered);
    },

    /**
     * Render document list grouped by category.
     */
    renderDocList(docs) {
        const container = document.getElementById("documents-container");
        if (!container) return;

        if (docs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">📄</span>
                    <p>No documents found${this.activeCategory !== 'all' ? ' in this category' : ''}.</p>
                    ${auth.isAdmin() ? `<a href="#/upload" class="btn btn-primary" style="margin-top:16px;">Upload First Document</a>` : ''}
                </div>
            `;
            return;
        }

        // Group documents by category
        const grouped = {};
        docs.forEach(doc => {
            const catName = doc.categories ? doc.categories.name : 'Uncategorised';
            if (!grouped[catName]) grouped[catName] = [];
            grouped[catName].push(doc);
        });

        let html = '';
        Object.entries(grouped).forEach(([catName, catDocs]) => {
            html += `
                <div class="category-section">
                    <h3 class="category-section-title">
                        <span>${this.getCategoryIcon(catName)}</span>
                        ${catName}
                        <span class="badge">${catDocs.length}</span>
                    </h3>
                    <div class="docs-list">
                        ${catDocs.map(doc => this.buildDocCard(doc)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    /**
     * Return an appropriate emoji icon for the document category.
     */
    getCategoryIcon(catName) {
        const icons = {
            'Identity': '🪪',
            'Education': '🎓',
            'Vehicle': '🚗',
            'Insurance': '🛡️',
            'Property': '🏠',
            'Financial': '💰',
            'Other': '📄'
        };
        return icons[catName] || '📁';
    },

    /**
     * Build HTML for a single document card row.
     */
    buildDocCard(doc) {
        const isImage = doc.file_type && doc.file_type.startsWith('image/');
        const isPDF = doc.file_type === 'application/pdf';
        const icon = isPDF ? '📑' : (isImage ? '🖼️' : '📄');
        const dateAdded = new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        return `
            <div class="doc-card" onclick="documents.openViewer('${doc.id}')">
                <div class="doc-card-info">
                    <span class="doc-icon">${icon}</span>
                    <div class="doc-details">
                        <span class="doc-name" title="${doc.name}">${doc.name}</span>
                        <span class="doc-meta">${utils.formatBytes(doc.file_size)} • ${dateAdded}</span>
                    </div>
                </div>
                <div class="doc-card-actions">
                    <button class="btn-icon" title="View document" onclick="event.stopPropagation(); documents.openViewer('${doc.id}')">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button class="btn-icon" title="Download" onclick="event.stopPropagation(); documents.downloadDocument('${doc.id}', '${doc.name}', '${doc.file_name}')">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    ${auth.isAdmin() ? `
                    <button class="btn-icon btn-icon-danger" title="Delete document" onclick="event.stopPropagation(); documents.deleteDocument('${doc.id}', '${doc.name}', '${doc.storage_path}')">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Open the document viewer modal and generate signed URL.
     * @param {string} docId - documents.id UUID.
     */
    async openViewer(docId) {
        const doc = this.allDocs.find(d => d.id === docId);
        if (!doc) return;

        const modal = document.getElementById("modal-doc-viewer");
        const titleEl = document.getElementById("view-doc-title");
        const metaEl = document.getElementById("view-doc-meta");
        const descEl = document.getElementById("view-doc-desc");
        const previewEl = document.getElementById("doc-preview-area");
        const openTabBtn = document.getElementById("btn-doc-open-tab");
        const downloadBtn = document.getElementById("btn-doc-download");
        const printBtn = document.getElementById("btn-doc-print");

        if (!modal) return;

        // Populate header info
        const catName = doc.categories ? doc.categories.name : 'Unknown';
        if (titleEl) titleEl.textContent = doc.name;
        if (metaEl) metaEl.textContent = `${catName} • ${utils.formatBytes(doc.file_size)} • ${new Date(doc.created_at).toLocaleDateString()}`;
        if (descEl) {
            descEl.textContent = doc.description || '';
            descEl.style.display = doc.description ? 'block' : 'none';
        }
        if (previewEl) previewEl.innerHTML = '<div class="loading-placeholder">🔒 Generating secure temporary link...</div>';

        modal.classList.remove("hidden");

        // Generate a fresh signed URL for this viewing session
        try {
            const { data, error } = await supabaseClient.storage
                .from('documents')
                .createSignedUrl(doc.storage_path, 300); // 5 minute expiry

            if (error) throw error;

            const signedUrl = data.signedUrl;
            const isImage = doc.file_type && doc.file_type.startsWith('image/');
            const isPDF = doc.file_type === 'application/pdf';

            // Render preview
            if (previewEl) {
                if (isImage) {
                    previewEl.innerHTML = `<img class="preview-image" src="${signedUrl}" alt="${doc.name}">`;
                } else if (isPDF) {
                    previewEl.innerHTML = `<iframe class="preview-pdf" src="${signedUrl}" title="${doc.name}"></iframe>`;
                } else {
                    previewEl.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📄</span><p>Preview not available for this file type.</p></div>`;
                }
            }

            // Wire up Open in Tab button
            if (openTabBtn) {
                openTabBtn.onclick = () => window.open(signedUrl, '_blank');
            }

            // Wire up Download button
            if (downloadBtn) {
                downloadBtn.onclick = () => this.triggerDownload(signedUrl, doc.name, doc.file_name);
            }

            // Wire up Print button
            if (printBtn) {
                printBtn.onclick = () => this.printDocument(signedUrl, doc.name, isImage, isPDF);
            }

        } catch (err) {
            console.error("Signed URL error:", err);
            if (previewEl) {
                previewEl.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>Unable to load this document. Please try again.</p></div>`;
            }
            utils.showToast("Failed to generate secure document link.", "danger");
        }
    },

    /**
     * Download a document by generating a signed URL and triggering download.
     */
    async downloadDocument(docId, docName, fileName) {
        utils.showToast("Generating secure download link...", "info");

        const doc = this.allDocs.find(d => d.id === docId);
        if (!doc) return;

        try {
            const { data, error } = await supabaseClient.storage
                .from('documents')
                .createSignedUrl(doc.storage_path, 120);

            if (error) throw error;

            this.triggerDownload(data.signedUrl, docName, doc.file_name);
        } catch (err) {
            console.error("Download error:", err);
            utils.showToast("Download failed. Please try again.", "danger");
        }
    },

    /**
     * Create a download anchor and trigger browser file save dialog.
     */
    triggerDownload(url, docName, fileName) {
        const safeName = utils.sanitizeFileName(fileName || docName);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        utils.showToast("Download started.", "success");
    },

    /**
     * Print a document using a hidden iframe or window.
     */
    printDocument(signedUrl, docName, isImage, isPDF) {
        // Inject a hidden print-only section into the DOM
        let printSection = document.getElementById("print-section");
        if (!printSection) {
            printSection = document.createElement('div');
            printSection.id = "print-section";
            document.body.appendChild(printSection);
        }

        if (isPDF) {
            // For PDF, open in new tab and let browser handle print
            const win = window.open(signedUrl, '_blank');
            if (win) win.print();
            return;
        }

        // For images: build a clean print layout
        printSection.innerHTML = `
            <div class="print-header">
                <div class="print-title">🗄️ Family Document Locker</div>
                <div class="print-meta">
                    <p><strong>${docName}</strong></p>
                    <p>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>
            <div class="print-body">
                <img class="print-image" src="${signedUrl}" alt="${docName}">
            </div>
        `;

        window.print();
    },

    /**
     * Delete a document: first from Storage, then from database.
     */
    async deleteDocument(docId, docName, storagePath) {
        const confirmed = await utils.showConfirm(
            `Delete "${docName}"?`,
            'This will permanently remove the file from storage. This action cannot be undone.',
            'Delete',
            'Cancel'
        );

        if (!confirmed) return;

        utils.showToast("Deleting document...", "info");

        try {
            // Step 1: Remove from supabaseClient Storage
            const { error: storageError } = await supabaseClient.storage
                .from('documents')
                .remove([storagePath]);

            if (storageError) throw storageError;

            // Step 2: Remove from database
            const { error: dbError } = await supabaseClient
                .from('documents')
                .delete()
                .eq('id', docId);

            if (dbError) {
                utils.showToast("File deleted from storage, but database record removal failed. Please refresh.", "warning");
                console.error("DB deletion failure after storage delete:", dbError);
                return;
            }

            utils.showToast(`"${docName}" deleted successfully.`, "success");

            // Remove from local array and re-render
            this.allDocs = this.allDocs.filter(d => d.id !== docId);
            this.buildCategoryTabs();
            this.filterByCategory(this.activeCategory, null);

        } catch (err) {
            console.error("Delete error:", err);
            utils.showToast("Failed to delete document. Please try again.", "danger");
        }
    },

    /**
     * Close the document viewer modal.
     */
    closeViewer() {
        const modal = document.getElementById("modal-doc-viewer");
        if (modal) {
            modal.classList.add("hidden");
        }

        // Clean up the print section to avoid stale signed URLs
        const printSection = document.getElementById("print-section");
        if (printSection) printSection.innerHTML = '';
    }
};
