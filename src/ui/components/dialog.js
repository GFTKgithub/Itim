// Create and render a custom dialog message
export function showDialog({
    title,
    message,
    icon = '⚠️',
    showCancel = false,
    confirmText = 'אישור',
    cancelText = 'ביטול',
    inputs = []
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

        inputs.forEach((inputConfig, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex flex-col gap-1';

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
                        // Supports both objects { value, text } or plain strings
                        option.value = opt.value !== undefined ? opt.value : opt;
                        option.textContent = opt.text !== undefined ? opt.text : opt;
                        element.appendChild(option);
                    });
                }
            } else {
                // Handle standard text/number inputs
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
        });

        function closeDialog(isConfirmed) {
            let result = isConfirmed;

            if (isConfirmed && inputs.length > 0) {
                result = {};
                // Query both input and select tags
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

            setTimeout(() => {
                overlay.classList.add('hidden');
                confirmBtn.replaceWith(confirmBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(result);
            }, 200);
        }

        document.getElementById('dialogConfirmBtn').addEventListener('click', () => closeDialog(true));
        document.getElementById('dialogCancelBtn').addEventListener('click', () => closeDialog(false));

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