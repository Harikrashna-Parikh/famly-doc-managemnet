/* ==========================================================================
   FAMILY DIGITAL DOCUMENT LOCKER - UTILITIES & HELPERS
   File: js/utils.js
   ========================================================================== */

const utils = {
    /**
     * Display a temporary toast notification in the UI.
     * @param {string} message - Message text.
     * @param {'success'|'danger'|'warning'|'info'} type - Toast theme classification.
     */
    showToast(message, type = 'info') {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let emoji = 'ℹ️';
        if (type === 'success') emoji = '✅';
        if (type === 'danger') emoji = '❌';
        if (type === 'warning') emoji = '⚠️';

        toast.innerHTML = `
            <span>${emoji}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Slide out and remove
        setTimeout(() => {
            toast.style.transform = "translateX(120%)";
            toast.style.opacity = "0";
            toast.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    },

    /**
     * Format raw byte sizes into human readable dimensions.
     * @param {number} bytes - Raw file size in bytes.
     * @param {number} decimals - Precision decimal count.
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Sanitize user filenames to prevent directory traversal and resolve cross-browser spaces.
     * @param {string} fileName - Original uploaded filename.
     */
    sanitizeFileName(fileName) {
        if (!fileName) return "document";
        // Extract extension
        const lastDot = fileName.lastIndexOf('.');
        let base = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
        const ext = lastDot !== -1 ? fileName.substring(lastDot) : "";
        
        // Clean base name: remove path indicators and non-standard chars
        base = base
            .replace(/[\/\?<>\\:\*\|":]/g, '') // remove disallowed windows chars
            .replace(/\s+/g, '-')              // replace spaces with dashes
            .replace(/[^a-zA-Z0-9\-_]/g, '')  // strip any remaining non-alphanumeric chars
            .substring(0, 100);                // truncate to sensible length
            
        return (base || "document") + ext.toLowerCase();
    },

    /**
     * Client-side image resizer using Canvas. Compresses huge camera photographs.
     * Keeps PDF formats untouched.
     * @param {File} file - Original file input.
     * @param {number} maxSide - Longest dimension resolution boundary.
     * @param {number} quality - JPEG compression quality decimal.
     * @returns {Promise<File>} - Resolves with optimized File (or original if not compressed).
     */
    async compressImage(file, maxSide = 2048, quality = 0.85) {
        // Skip check if it is not an image or is a GIF (which would lose animation if redrawn to canvas)
        if (!file.type.startsWith("image/") || file.type === "image/gif") {
            return file;
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    // Skip compression if the image is already small in dimensions
                    if (width <= maxSide && height <= maxSide && file.size < 512000) {
                        resolve(file);
                        return;
                    }

                    // Maintain aspect ratio
                    if (width > maxSide || height > maxSide) {
                        if (width > height) {
                            height = Math.round((height * maxSide) / width);
                            width = maxSide;
                        } else {
                            width = Math.round((width * maxSide) / height);
                            height = maxSide;
                        }
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }

                        const compressedFile = new File([blob], file.name, {
                            type: "image/jpeg",
                            lastModified: Date.now()
                        });

                        // Return compressed file only if it saves space
                        if (compressedFile.size < file.size) {
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    }, "image/jpeg", quality);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    },

    /**
     * Promisified Confirmation Dialog showing modal views.
     * @param {string} title - Header text.
     * @param {string} message - Description message.
     * @param {string} okText - Confirmation button label.
     * @param {string} cancelText - Decline button label.
     * @returns {Promise<boolean>} - Resolves to true on confirm, false on cancel.
     */
    showConfirm(title, message, okText = 'Delete', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const modal = document.getElementById("modal-confirm");
            const titleEl = document.getElementById("confirm-title");
            const msgEl = document.getElementById("confirm-message");
            const okBtn = document.getElementById("btn-confirm-ok");
            const cancelBtn = document.getElementById("btn-confirm-cancel");

            if (!modal || !okBtn || !cancelBtn) {
                resolve(false);
                return;
            }

            titleEl.textContent = title;
            msgEl.textContent = message;
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;

            // Adjust button style if it's not a delete action
            if (okText.toLowerCase() === 'delete') {
                okBtn.className = "btn btn-danger";
            } else {
                okBtn.className = "btn btn-primary";
            }

            modal.classList.remove("hidden");

            const cleanup = (result) => {
                modal.classList.add("hidden");
                okBtn.removeEventListener("click", handleOk);
                cancelBtn.removeEventListener("click", handleCancel);
                resolve(result);
            };

            const handleOk = () => cleanup(true);
            const handleCancel = () => cleanup(false);

            okBtn.addEventListener("click", handleOk);
            cancelBtn.addEventListener("click", handleCancel);
        });
    }
};
