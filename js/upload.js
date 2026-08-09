/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - UPLOAD MODULE
   File: js/upload.js
   ========================================================================== */

const upload = {
    selectedFile: null,
    processedFile: null,

    /**
     * Initialize the upload view and populate dropdowns.
     */
    async renderUploadView() {
        if (!auth.isAdmin()) {
            utils.showToast("Upload is restricted to administrators.", "danger");
            app.navigate('/dashboard');
            return;
        }

        await this.populateDropdowns();
        this.bindFileInput();
    },

    /**
     * Populate the Family Member and Category dropdowns.
     */
    async populateDropdowns() {
        const memberSelect = document.getElementById("upload-member");
        const catSelect = document.getElementById("upload-category");

        if (!memberSelect || !catSelect) return;

        memberSelect.innerHTML = '<option value="" disabled selected>Loading members...</option>';
        catSelect.innerHTML = '<option value="" disabled selected>Loading categories...</option>';

        try {
            const [membersRes, catsRes] = await Promise.all([
                supabaseClient.from('family_members').select('id, name, display_name').eq('is_active', true).order('name'),
                supabaseClient.from('categories').select('id, name').order('name')
            ]);

            if (membersRes.error) throw membersRes.error;
            if (catsRes.error) throw catsRes.error;

            const members = membersRes.data || [];
            const categories = catsRes.data || [];

            memberSelect.innerHTML = '<option value="" disabled selected>Select Family Member...</option>' +
                members.map(m => `<option value="${m.id}">${m.display_name || m.name}</option>`).join('');

            catSelect.innerHTML = '<option value="" disabled selected>Select Category...</option>' +
                categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        } catch (err) {
            console.error("Upload dropdown error:", err);
            memberSelect.innerHTML = '<option value="" disabled selected>Error loading members</option>';
            catSelect.innerHTML = '<option value="" disabled selected>Error loading categories</option>';
            utils.showToast("Could not load upload form options.", "danger");
        }
    },

    /**
     * Bind file input and drop zone events.
     */
    bindFileInput() {
        const fileInput = document.getElementById("upload-file");
        const dropZone = document.getElementById("file-drop-zone");
        const clearBtn = document.getElementById("btn-clear-file");

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleFileSelection(e.target.files[0]);
                }
            });
        }

        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.handleFileSelection(e.dataTransfer.files[0]);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearFileSelection();
            });
        }
    },

    /**
     * Validate and handle the selected file.
     */
    async handleFileSelection(file) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(extension)) {
            utils.showToast("Unsupported file type. Only JPG, PNG, WEBP, and PDF files are allowed.", "danger");
            this.clearFileSelection();
            return;
        }

        // Check maximum file size: 50 MB
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            utils.showToast(`File is too large (${utils.formatBytes(file.size)}). Maximum size is 50 MB.`, "danger");
            this.clearFileSelection();
            return;
        }

        this.selectedFile = file;
        this.processedFile = file;

        // Update UI immediately with original size
        this.updateFileSelectionUI(file, file);

        // Compress image files (skip PDFs)
        if (file.type.startsWith('image/') && file.size > 300 * 1024) {
            const compressed = await utils.compressImage(file);
            this.processedFile = compressed;
            this.updateFileSelectionUI(file, compressed);

            // Show compression alert if file size was actually reduced
            if (compressed.size < file.size) {
                const alertEl = document.getElementById("compression-alert");
                const statsEl = document.getElementById("compression-stats");
                if (alertEl) alertEl.classList.remove('hidden');
                if (statsEl) statsEl.textContent = `Original: ${utils.formatBytes(file.size)} → Compressed: ${utils.formatBytes(compressed.size)}`;
            }
        }
    },

    /**
     * Update the drop zone UI to show selected file details.
     */
    updateFileSelectionUI(originalFile, processedFile) {
        const dropZoneContent = document.querySelector('.drop-zone-content');
        const selectedSection = document.getElementById("drop-zone-selected");
        const fileNameEl = document.getElementById("selected-file-name");
        const fileSizeEl = document.getElementById("selected-file-size");
        const fileIconEl = document.getElementById("selected-file-icon");

        if (dropZoneContent) dropZoneContent.classList.add('hidden');
        if (selectedSection) selectedSection.classList.remove('hidden');
        if (fileNameEl) fileNameEl.textContent = originalFile.name;
        if (fileSizeEl) fileSizeEl.textContent = `${utils.formatBytes(processedFile.size)} ${processedFile.size < originalFile.size ? '(compressed)' : ''}`;
        if (fileIconEl) fileIconEl.textContent = originalFile.type === 'application/pdf' ? '📑' : '🖼️';
    },

    /**
     * Clear file selection and reset UI.
     */
    clearFileSelection() {
        this.selectedFile = null;
        this.processedFile = null;

        const fileInput = document.getElementById("upload-file");
        if (fileInput) fileInput.value = '';

        const dropZoneContent = document.querySelector('.drop-zone-content');
        const selectedSection = document.getElementById("drop-zone-selected");
        const alertEl = document.getElementById("compression-alert");

        if (dropZoneContent) dropZoneContent.classList.remove('hidden');
        if (selectedSection) selectedSection.classList.add('hidden');
        if (alertEl) alertEl.classList.add('hidden');
    },

    /**
     * Handle upload form submission.
     */
    async handleUploadSubmit(e) {
        e.preventDefault();

        if (!auth.isAdmin()) return;
        if (!this.processedFile) {
            utils.showToast("Please select a file to upload.", "warning");
            return;
        }

        const memberId = document.getElementById("upload-member")?.value;
        const categoryId = document.getElementById("upload-category")?.value;
        const docName = document.getElementById("upload-name")?.value?.trim();
        const docDesc = document.getElementById("upload-desc")?.value?.trim();

        if (!memberId || !categoryId || !docName) {
            utils.showToast("Please fill in all required fields.", "warning");
            return;
        }

        const submitBtn = document.getElementById("btn-upload-submit");
        const btnText = document.getElementById("upload-btn-text");
        const loadingIcon = document.getElementById("upload-loading-icon");

        // Set loading state
        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.textContent = 'Uploading...';
        if (loadingIcon) loadingIcon.classList.remove('hidden');

        try {
            // Generate a safe storage path
            const docId = crypto.randomUUID();
            const safeFileName = utils.sanitizeFileName(this.processedFile.name);
            const storagePath = `${memberId}/${docId}/${safeFileName}`;

            // Upload file to supabaseClient Storage
            const { error: storageErr } = await supabaseClient.storage
                .from('documents')
                .upload(storagePath, this.processedFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: this.processedFile.type
                });

            if (storageErr) throw storageErr;

            // Insert metadata record into database
            const { error: dbErr } = await supabaseClient
                .from('documents')
                .insert({
                    id: docId,
                    family_member_id: memberId,
                    category_id: categoryId,
                    name: docName,
                    description: docDesc || null,
                    storage_path: storagePath,
                    file_name: this.processedFile.name,
                    file_type: this.processedFile.type,
                    file_size: this.processedFile.size,
                    created_by: auth.currentUser.id
                });

            if (dbErr) {
                // Attempt cleanup: remove orphaned storage file
                await supabaseClient.storage.from('documents').remove([storagePath]);
                throw dbErr;
            }

            utils.showToast(`"${docName}" uploaded successfully!`, "success");

            // Reset form
            document.getElementById("upload-form")?.reset();
            this.clearFileSelection();
            await this.populateDropdowns();

        } catch (err) {
            console.error("Upload error:", err);
            utils.showToast(`Upload failed: ${err.message || 'Please try again.'}`, "danger");
        } finally {
            // Reset button state
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) btnText.textContent = 'Upload Document';
            if (loadingIcon) loadingIcon.classList.add('hidden');
        }
    }
};
