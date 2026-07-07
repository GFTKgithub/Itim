/**
 * Dialog system with support for dynamic field visibility.
 * 
 * Features:
 * - Standard show/hide dialog
 * - Dynamic field visibility based on select changes
 * - Dialog registry for managing multiple dialogs
 */

// Dialog registry: tracks active dialogs by ID
const dialogRegistry = {};

/**
 * Show a dialog with optional inputs and dynamic field visibility.
 * 
 * Inputs can have a `dependsOn` property to conditionally show/hide fields:
 *   { name: 'sprintDays', type: 'number', label: '...', dependsOn: { field: 'strategy_0', value: 'sprint' } }
 * 
 * @param {Object} config
 * @param {string} config.title - Dialog title
 * @param {string} config.message - Dialog message
 * @param {string} config.icon - Dialog icon emoji
 * @param {boolean} config.showCancel - Show cancel button
 * @param {string} config.confirmText - Confirm button text
 * @param {string} config.cancelText - Cancel button text
 * @param {Array} config.inputs - Array of input configs
 * @param {string} [config.id] - Optional dialog ID for registry
 * @returns {Promise<Object|boolean>} - Returns result object or false if cancelled
 */
export function showDialog({
    title,
    message,
    icon = '⚠️',
    showCancel = false,
    confirmText = 'אישור',
    cancelText = 'ביטול',
    inputs = [],
    id = null
}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialogOverlay');
        const dialogBox = document.getElementById('customDialogBox');
        const titleEl = document.getElementById('dialogTitle');
        const messageEl = document.getElementById('dialogMessage');
        const iconEl = document.getElementById('dialogIcon');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        const cancelBtn = document.getElementById('dialogCancelBtn');
        const inputContainer = document.getElementById('dialogInputContainer');

        inputContainer.innerHTML = '';

        titleEl.textContent = title;
        messageEl.textContent = message;
        iconEl.innerHTML = icon;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        if (showCancel || inputs.length > 0) {
            cancelBtn.classList.remove('hidden');
        } else {
            cancelBtn.classList.add('hidden');
        }

        // Store all field wrappers for dynamic visibility
        const fieldWrappers = [];

        // Render all inputs
        inputs.forEach((inputConfig, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex flex-col gap-1';
            wrapper.dataset.fieldName = inputConfig.name || `input_${index}`;

            // Apply initial visibility based on dependsOn
            if (inputConfig.dependsOn) {
                wrapper.style.display = 'none';
            }

            if (inputConfig.label) {
                const label = document.createElement('label');
                label.className = 'text-xs font-bold text-slate-500 mr-1';
                label.textContent = inputConfig.label;
                wrapper.appendChild(label);
            }

            let element;

            // Handle Dropdown / Select menu
            if (inputConfig.type === 'select') {
                element = document.createElement('select');
                
                if (inputConfig.options && Array.isArray(inputConfig.options)) {
                    inputConfig.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value !== undefined ? opt.value : opt;
                        option.textContent = opt.text !== undefined ? opt.text : opt;
                        element.appendChild(option);
                    });
                }
            } else {
                // Handle standard text/number/date inputs
                element = document.createElement('input');
                element.type = inputConfig.type || 'text';
                element.placeholder = inputConfig.placeholder || '';
                
                if (inputConfig.type === 'number') {
                    if (inputConfig.min !== undefined) element.min = inputConfig.min;
                    if (inputConfig.max !== undefined) element.max = inputConfig.max;
                    if (inputConfig.step !== undefined) element.step = inputConfig.step;
                }
            }

            element.value = inputConfig.value !== undefined ? inputConfig.value : '';
            element.dataset.key = inputConfig.name || `input_${index}`;
            element.className = 'w-full border border-slate-300 rounded-lg p-2 bg-white text-sm focus:outline-none focus:border-blue-500';

            wrapper.appendChild(element);
            inputContainer.appendChild(wrapper);
            fieldWrappers.push({ wrapper, config: inputConfig, element });
        });

        // Wire up dynamic field visibility based on select changes
        function updateFieldVisibility() {
            fieldWrappers.forEach(({ wrapper, config }) => {
                if (!config.dependsOn) return;

                const { field, value } = config.dependsOn;
                const sourceField = inputContainer.querySelector(`[data-key="${field}"]`);
                if (!sourceField) return;

                const shouldShow = sourceField.value === value;
                wrapper.style.display = shouldShow ? 'flex' : 'none';
            });
        }

        // Attach change listeners to all select elements
        fieldWrappers.forEach(({ element, config }) => {
            if (config.type === 'select') {
                element.addEventListener('change', updateFieldVisibility);
            }
        });

        // Initial visibility update
        updateFieldVisibility();

        // Register in dialog registry if ID provided
        if (id) {
            dialogRegistry[id] = {
                updateFieldVisibility,
                fieldWrappers,
                inputContainer,
                close: () => closeDialog(false)
            };
        }

        function closeDialog(isConfirmed) {
            let result = isConfirmed;

            if (isConfirmed && inputs.length > 0) {
                result = {};
                const generatedFields = inputContainer.querySelectorAll('input, select');
                generatedFields.forEach(field => {
                    const key = field.dataset.key;
                    if (field.type === 'number') {
                        result[key] = field.value !== '' ? Number(field.value) : '';
                    } else {
                        result[key] = field.value;
                    }
                });
            }

            overlay.classList.remove('opacity-100');
            dialogBox.classList.remove('scale-100');
            overlay.classList.add('opacity-0');
            dialogBox.classList.add('scale-95');

            // Unregister from registry
            if (id) {
                delete dialogRegistry[id];
            }

            setTimeout(() => {
                overlay.classList.add('hidden');
                confirmBtn.replaceWith(confirmBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(result);
            }, 200);
        }

        // Use fresh references for event listeners
        const confirmHandler = () => closeDialog(true);
        const cancelHandler = () => closeDialog(false);

        document.getElementById('dialogConfirmBtn').addEventListener('click', confirmHandler);
        document.getElementById('dialogCancelBtn').addEventListener('click', cancelHandler);

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeDialog(false);
            }
        };

        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0', 'scale-95');
            overlay.classList.add('opacity-100', 'scale-100');
            
            const firstField = inputContainer.querySelector('input, select');
            if (firstField) firstField.focus();
        }, 10);
    });
}

/**
 * Update a specific dialog's field visibility programmatically.
 * @param {string} dialogId - The dialog ID
 */
export function updateDialogFields(dialogId) {
    const dialog = dialogRegistry[dialogId];
    if (dialog) {
        dialog.updateFieldVisibility();
    }
}

/**
 * Close a specific dialog by ID.
 * @param {string} dialogId - The dialog ID
 */
export function closeDialog(dialogId) {
    const dialog = dialogRegistry[dialogId];
    if (dialog) {
        dialog.close();
    }
}