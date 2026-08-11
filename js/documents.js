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
                    <button class="btn-icon" title="Share document" onclick="event.stopPropagation(); documents.shareDocument('${doc.id}')">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
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
        const shareBtn = document.getElementById("btn-doc-share");

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
                downloadBtn.onclick = () => this.downloadDocument(doc.id, doc.name, doc.file_name);
            }

            // Wire up Share button
            if (shareBtn) {
                shareBtn.onclick = () => this.shareDocument(doc.id);
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
     * Download a document by showing custom download options modal.
     */
    async downloadDocument(docId, docName, fileName) {
        const doc = this.allDocs.find(d => d.id === docId);
        if (!doc) return;

        this.openDownloadOptionsModal(doc);
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

        // For images: build a clean print layout containing only the document image
        printSection.innerHTML = `
            <img class="print-image" src="${signedUrl}" alt="${docName}">
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
    },

    /**
     * Share a document by trying mobile native share first, then falling back to custom share modal.
     */
    async shareDocument(docId) {
        const doc = this.allDocs.find(d => d.id === docId);
        if (!doc) return;

        // Try native Web Share API on mobile
        if (navigator.share && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            try {
                utils.showToast("Generating secure shareable link...", "info");
                const { data, error } = await supabaseClient.storage
                    .from('documents')
                    .createSignedUrl(doc.storage_path, 86400); // 24 hours

                if (error) throw error;

                await navigator.share({
                    title: doc.name,
                    text: `Family Locker shared document: ${doc.name}`,
                    url: data.signedUrl
                });
                utils.showToast("Document shared successfully.", "success");
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error("Native share failed, falling back to modal:", err);
                } else {
                    return; // User cancelled the native share sheet
                }
            }
        }

        // Fallback to our custom share modal
        this.openShareModal(docId);
    },

    /**
     * Generate 24h signed URL and open the custom Share Modal.
     */
    async openShareModal(docId) {
        const doc = this.allDocs.find(d => d.id === docId);
        if (!doc) return;

        const modal = document.getElementById("modal-doc-share");
        const nameEl = document.getElementById("share-doc-name");
        const linkInput = document.getElementById("share-link-input");
        const whatsappBtn = document.getElementById("share-whatsapp-btn");
        const emailBtn = document.getElementById("share-email-btn");
        const copyBtn = document.getElementById("share-copy-btn");
        const copyText = document.getElementById("share-copy-text");

        if (!modal) return;

        if (nameEl) nameEl.textContent = doc.name;
        if (linkInput) linkInput.value = 'Generating secure link...';
        if (copyText) copyText.textContent = 'Copy Link';

        modal.classList.remove("hidden");

        try {
            const { data, error } = await supabaseClient.storage
                .from('documents')
                .createSignedUrl(doc.storage_path, 86400); // 24 hours

            if (error) throw error;

            const signedUrl = data.signedUrl;
            if (linkInput) linkInput.value = signedUrl;

            // Wire up WhatsApp sharing
            if (whatsappBtn) {
                whatsappBtn.onclick = () => {
                    const text = encodeURIComponent(`Family Locker shared document: ${doc.name}\n${signedUrl}`);
                    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                };
            }

            // Wire up Email sharing
            if (emailBtn) {
                emailBtn.onclick = () => {
                    const subject = encodeURIComponent(`Shared Document: ${doc.name}`);
                    const body = encodeURIComponent(`Here is a secure link to the document "${doc.name}" from our Family Locker:\n\n${signedUrl}\n\nNote: This link will expire in 24 hours.`);
                    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                };
            }

            // Wire up Copy Button
            if (copyBtn) {
                copyBtn.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(signedUrl);
                        if (copyText) copyText.textContent = 'Copied! ✅';
                        utils.showToast("Link copied to clipboard!", "success");
                        setTimeout(() => {
                            if (copyText) copyText.textContent = 'Copy Link';
                        }, 2000);
                    } catch (err) {
                        console.error("Clipboard copy failed:", err);
                        utils.showToast("Failed to copy link. Please manually copy from the input field.", "warning");
                    }
                };
            }

        } catch (err) {
            console.error("Share URL generation error:", err);
            if (linkInput) linkInput.value = 'Failed to generate link.';
            utils.showToast("Failed to generate secure link.", "danger");
        }
    },

    /**
     * Generate 24h signed URL and open the Custom Download Options Modal.
     */
    async openDownloadOptionsModal(doc) {
        const modal = document.getElementById("modal-doc-download-options");
        const nameEl = document.getElementById("download-options-doc-name");
        const formatSelect = document.getElementById("download-format");
        
        const dimensionPreset = document.getElementById("download-dimension-preset");
        const customDimensions = document.getElementById("download-custom-dimensions");
        const widthInput = document.getElementById("download-width");
        const heightInput = document.getElementById("download-height");
        const lockAspectBtn = document.getElementById("btn-lock-aspect");
        
        const sizePreset = document.getElementById("download-size-preset");
        const customSizes = document.getElementById("download-custom-sizes");
        const minKbInput = document.getElementById("download-min-kb");
        const maxKbInput = document.getElementById("download-max-kb");
        
        const confirmBtn = document.getElementById("btn-download-options-confirm");
        const spinner = document.getElementById("download-options-spinner");
        const btnText = document.getElementById("download-options-btn-text");

        if (!modal) return;

        // Reset fields
        if (nameEl) nameEl.textContent = doc.name;
        if (formatSelect) formatSelect.value = "original";
        if (dimensionPreset) dimensionPreset.value = "original";
        if (customDimensions) customDimensions.classList.add("hidden");
        if (sizePreset) sizePreset.value = "original";
        if (customSizes) customSizes.classList.add("hidden");
        if (widthInput) widthInput.value = "";
        if (heightInput) heightInput.value = "";
        
        // Default aspect ratio locking
        let aspectLocked = true;
        if (lockAspectBtn) {
            lockAspectBtn.classList.add("active");
            lockAspectBtn.textContent = "🔒";
        }

        modal.classList.remove("hidden");

        // Keep track of original dimensions
        let originalWidth = 800;
        let originalHeight = 600;
        let originalAspectRatio = 1.333;
        let isImage = doc.file_type && doc.file_type.startsWith('image/');
        let isPDF = doc.file_type === 'application/pdf';

        // Set up event listeners for presets show/hide
        dimensionPreset.onchange = () => {
            if (dimensionPreset.value === "custom") {
                customDimensions.classList.remove("hidden");
            } else {
                customDimensions.classList.add("hidden");
            }
        };

        sizePreset.onchange = () => {
            if (sizePreset.value === "custom") {
                customSizes.classList.remove("hidden");
            } else {
                customSizes.classList.add("hidden");
            }
        };

        // Aspect ratio lock toggle
        if (lockAspectBtn) {
            lockAspectBtn.onclick = () => {
                aspectLocked = !aspectLocked;
                if (aspectLocked) {
                    lockAspectBtn.classList.add("active");
                    lockAspectBtn.textContent = "🔒";
                    // Recalculate height based on current width
                    if (widthInput.value && originalAspectRatio) {
                        heightInput.value = Math.round(widthInput.value / originalAspectRatio);
                    }
                } else {
                    lockAspectBtn.classList.remove("active");
                    lockAspectBtn.textContent = "🔓";
                }
            };
        }

        // Width / Height input listeners for aspect ratio
        widthInput.oninput = () => {
            if (aspectLocked && widthInput.value && originalAspectRatio) {
                heightInput.value = Math.round(widthInput.value / originalAspectRatio);
            }
        };

        heightInput.oninput = () => {
            if (aspectLocked && heightInput.value && originalAspectRatio) {
                widthInput.value = Math.round(heightInput.value * originalAspectRatio);
            }
        };

        // Fetch original dimensions in background to prefill
        try {
            const { data, error } = await supabaseClient.storage
                .from('documents')
                .createSignedUrl(doc.storage_path, 120);

            if (error) throw error;

            const signedUrl = data.signedUrl;

            if (isImage) {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    originalWidth = img.naturalWidth;
                    originalHeight = img.naturalHeight;
                    originalAspectRatio = originalWidth / originalHeight;
                    widthInput.placeholder = originalWidth;
                    heightInput.placeholder = originalHeight;
                    if (!widthInput.value) widthInput.value = originalWidth;
                    if (!heightInput.value) heightInput.value = originalHeight;
                };
                img.src = signedUrl;
            } else if (isPDF) {
                // Fetch first page viewport using pdfjsLib
                const pdfjsLib = window['pdfjs-dist/build/pdf'];
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                const loadingTask = pdfjsLib.getDocument(signedUrl);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.0 });
                originalWidth = Math.round(viewport.width);
                originalHeight = Math.round(viewport.height);
                originalAspectRatio = originalWidth / originalHeight;
                widthInput.placeholder = originalWidth;
                heightInput.placeholder = originalHeight;
                if (!widthInput.value) widthInput.value = originalWidth;
                if (!heightInput.value) heightInput.value = originalHeight;
            }
        } catch (e) {
            console.warn("Could not pre-fetch document dimensions:", e);
        }

        // Action when Download button inside modal is clicked
        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            if (spinner) spinner.classList.remove("hidden");
            if (btnText) btnText.textContent = "Processing...";

            try {
                // Get selected values
                const format = formatSelect.value;
                const dimMode = dimensionPreset.value;
                const sizeMode = sizePreset.value;
                
                let targetWidth = parseInt(widthInput.value) || originalWidth;
                let targetHeight = parseInt(heightInput.value) || originalHeight;
                
                let minKb = parseInt(minKbInput.value) || 10;
                let maxKb = parseInt(maxKbInput.value) || 500;

                utils.showToast("Preparing document files...", "info");

                // Get original signed URL
                const { data, error } = await supabaseClient.storage
                    .from('documents')
                    .createSignedUrl(doc.storage_path, 120);

                if (error) throw error;
                const signedUrl = data.signedUrl;

                // Case 1: Downloading completely original file without modifications
                if (format === 'original' && dimMode === 'original' && sizeMode === 'original') {
                    // Force attachment download of original file
                    const safeName = utils.sanitizeFileName(doc.file_name || doc.name);
                    const dlRes = await supabaseClient.storage
                        .from('documents')
                        .createSignedUrl(doc.storage_path, 120, { download: safeName });
                    
                    if (dlRes.error) throw dlRes.error;
                    this.triggerDownload(dlRes.data.signedUrl, doc.name, doc.file_name);
                    modal.classList.add("hidden");
                    return;
                }

                // Case 2: Perform client-side canvas processing (converting format, resizing, and compressing)
                let canvas;
                if (isImage) {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = signedUrl;
                    });
                    
                    canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                } else if (isPDF) {
                    const pdfjsLib = window['pdfjs-dist/build/pdf'];
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                    const loadingTask = pdfjsLib.GlobalWorkerOptions.getDocument(signedUrl);
                    const pdf = await loadingTask.promise;
                    const page = await pdf.getPage(1);
                    
                    // Render page at scale
                    const scale = targetWidth / page.getViewport({ scale: 1.0 }).width;
                    const viewport = page.getViewport({ scale: scale });
                    canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                } else {
                    // Non-renderable format (like word doc) - we can only download original
                    utils.showToast("Cannot customize sizes or formats for this file type. Downloading original.", "warning");
                    const safeName = utils.sanitizeFileName(doc.file_name || doc.name);
                    const dlRes = await supabaseClient.storage
                        .from('documents')
                        .createSignedUrl(doc.storage_path, 120, { download: safeName });
                    
                    if (dlRes.error) throw dlRes.error;
                    this.triggerDownload(dlRes.data.signedUrl, doc.name, doc.file_name);
                    modal.classList.add("hidden");
                    return;
                }

                // Format setup
                let targetFormat = format;
                if (targetFormat === 'original') {
                    // Match original file extension
                    const ext = doc.file_name ? doc.file_name.split('.').pop().toLowerCase() : '';
                    targetFormat = ['jpg', 'jpeg', 'png', 'pdf'].includes(ext) ? ext : 'jpg';
                }
                if (targetFormat === 'jpeg') targetFormat = 'jpg';

                let finalBlob;
                let extension = targetFormat;
                
                if (targetFormat === 'pdf') {
                    // Compile canvas to PDF using jsPDF library
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF({
                        orientation: canvas.width > canvas.height ? 'l' : 'p',
                        unit: 'px',
                        format: [canvas.width, canvas.height]
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
                    finalBlob = pdf.output('blob');
                } else {
                    // Compress image canvas to JPG / PNG within size limit if requested
                    if (sizeMode === 'custom') {
                        finalBlob = await this.compressImageToSizeRange(canvas, targetFormat, minKb, maxKb);
                    } else {
                        // Standard conversion without size constraint
                        const mimeType = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
                        finalBlob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
                    }
                }

                // Trigger blob download in browser
                const baseName = doc.name.replace(/\.[^/.]+$/, ""); // Strip existing extension
                const finalFilename = `${baseName}.${extension}`;
                this.triggerBlobDownload(finalBlob, finalFilename);
                utils.showToast(`Custom download completed successfully!`, "success");
                modal.classList.add("hidden");

            } catch (err) {
                console.error("Custom download failure:", err);
                utils.showToast("Failed to process custom download. Downloading original file instead.", "warning");
                // Fallback to original download
                try {
                    const safeName = utils.sanitizeFileName(doc.file_name || doc.name);
                    const dlRes = await supabaseClient.storage
                        .from('documents')
                        .createSignedUrl(doc.storage_path, 120, { download: safeName });
                    if (dlRes.error) throw dlRes.error;
                    this.triggerDownload(dlRes.data.signedUrl, doc.name, doc.file_name);
                    modal.classList.add("hidden");
                } catch (fallbackErr) {
                    utils.showToast("Download failed entirely.", "danger");
                }
            } finally {
                confirmBtn.disabled = false;
                if (spinner) spinner.classList.add("hidden");
                if (btnText) btnText.textContent = "Download";
            }
        };
    },

    /**
     * Compress image canvas iteratively to fit within minKb and maxKb limits.
     */
    async compressImageToSizeRange(canvas, format, minKb, maxKb) {
        let quality = 0.92;
        let mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        let blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));

        if (format === 'png') {
            // PNG doesn't support quality loss, so we must iteratively scale down canvas if it exceeds max size
            let scale = 0.9;
            let iterations = 0;
            const maxBytes = maxKb * 1024;
            while (blob.size > maxBytes && iterations < 7) {
                iterations++;
                const newCanvas = document.createElement('canvas');
                newCanvas.width = Math.round(canvas.width * scale);
                newCanvas.height = Math.round(canvas.height * scale);
                const ctx = newCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
                canvas = newCanvas;
                blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType));
                scale *= 0.8;
            }
        } else {
            // JPEG supports quality adjustments and scaling
            let iterations = 0;
            const minBytes = minKb * 1024;
            const maxBytes = maxKb * 1024;

            while ((blob.size > maxBytes || blob.size < minBytes) && iterations < 10) {
                iterations++;
                if (blob.size > maxBytes) {
                    quality -= 0.15;
                    if (quality < 0.1) {
                        // Quality is too low, let's scale down pixel dimensions instead
                        const newCanvas = document.createElement('canvas');
                        newCanvas.width = Math.round(canvas.width * 0.75);
                        newCanvas.height = Math.round(canvas.height * 0.75);
                        const ctx = newCanvas.getContext('2d');
                        ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
                        canvas = newCanvas;
                        quality = 0.85; // reset quality for smaller resolution
                    }
                } else if (blob.size < minBytes) {
                    if (quality < 0.95) {
                        quality += 0.1;
                    } else {
                        break; // Cannot increase quality any further without upscaling
                    }
                }
                blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, Math.max(0.05, Math.min(1, quality))));
            }
        }

        return blob;
    },

    /**
     * Download a raw Blob directly in the browser.
     */
    triggerBlobDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
