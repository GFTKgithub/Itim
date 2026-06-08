import { formatGematria, numberToHebrew } from '../utils/gematria.js';

// Create custom dialog message
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

            const input = document.createElement('input');
            input.type = inputConfig.type || 'text'; // text, date, number, password
            input.placeholder = inputConfig.placeholder || '';
            input.value = inputConfig.value !== undefined ? inputConfig.value : '';
            input.dataset.key = inputConfig.name || `input_${index}`;
            
            input.className = 'w-full border border-slate-300 rounded-lg p-2 bg-white text-sm focus:outline-none focus:border-blue-500';

            if (inputConfig.type === 'number') {
                if (inputConfig.min !== undefined) input.min = inputConfig.min;
                if (inputConfig.max !== undefined) input.max = inputConfig.max;
                if (inputConfig.step !== undefined) input.step = inputConfig.step;
            }

            wrapper.appendChild(input);
            inputContainer.appendChild(wrapper);
        });

        function closeDialog(isConfirmed) {
            let result = isConfirmed;

            if (isConfirmed && inputs.length > 0) {
                result = {};
                const generatedInputs = inputContainer.querySelectorAll('input');
                generatedInputs.forEach(input => {
                    const key = input.dataset.key;

                    if (input.type === 'number') {
                        result[key] = input.value !== '' ? Number(input.value) : '';
                    } else {
                        result[key] = input.value;
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
            
            const firstInput = inputContainer.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 10);
    });
}

// Updates a Hebrew date label based on a gregorian date element
export function updateHebrewLabel(input, label) {
    if (!label) return;

    if (!input.value) {
        label.textContent = "";
        return;
    }

    try {
        const selectedDate = new Date(input.value);

        // Use he-IL with hebrew calendar to extract precise localized strings and numeric values
        const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).formatToParts(selectedDate);

        const dayNum = parseInt(parts.find(p => p.type === 'day').value, 10);
        let yearNum = parseInt(parts.find(p => p.type === 'year').value, 10);

        // Dynamically pull the exact Hebrew month name string directly from the browser's engine
        const monthName = parts.find(p => p.type === 'month').value;

        if (yearNum < 1000) yearNum += 5000;

        const rawDayHebrew = numberToHebrew(dayNum);
        const rawYearHebrew = numberToHebrew(yearNum);

        const dayHebrew = formatGematria(dayNum, rawDayHebrew);
        const yearHebrew = formatGematria(yearNum, rawYearHebrew);

        // Update display text formatting
        label.textContent = `(${dayHebrew} ב${monthName} ${yearHebrew})`;

    } catch (e) {
        console.error("Error generating custom Hebrew date format string", e);
        label.textContent = "";
    }
}
