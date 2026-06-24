// --- Book Sequence Drag and Drop Interaction ---
export function setupBookSequenceDragAndDrop({ onReorder, onRemove }) {
    const bookSequenceList = document.getElementById('bookSequenceList');
    if (!bookSequenceList) return;

    let dragElement = null;
    let mirrorElement = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let autoScrollFrameId = null;
    let currentMouse = { x: 0, y: 0, pointerId: null };

    function updateDragPositionAndSorting() {
        if (!dragElement || !mirrorElement) return;
        const listRect = bookSequenceList.getBoundingClientRect();
        const mirrorRect = mirrorElement.getBoundingClientRect();
        const idealTop = currentMouse.y - dragOffsetY;
        const clampedTop = Math.max(listRect.top, Math.min(idealTop, listRect.bottom - mirrorRect.height));

        mirrorElement.style.top = `${clampedTop}px`;
        mirrorElement.style.left = `${currentMouse.x - dragOffsetX}px`;

        const rows = [...bookSequenceList.querySelectorAll('.drag-row')];
        const mirrorMidY = clampedTop + mirrorRect.height / 2;
        const currentDragIndex = rows.indexOf(dragElement);

        for (let i = 0; i < rows.length; i++) {
            const targetRow = rows[i];
            if (targetRow === dragElement) continue;

            const box = targetRow.getBoundingClientRect();
            const boxMidY = box.top + box.height / 2;

            if (i < currentDragIndex && mirrorMidY < boxMidY) {
                bookSequenceList.insertBefore(dragElement, targetRow);
                break;
            } else if (i > currentDragIndex && mirrorMidY > boxMidY) {
                bookSequenceList.insertBefore(dragElement, targetRow.nextElementSibling);
                break;
            }
        }
    }

    bookSequenceList.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.drag-handle');
        const row = e.target.closest('.drag-row');
        if (!handle || !row) return;

        e.preventDefault();
        dragElement = row;
        bookSequenceList.setPointerCapture(e.pointerId);

        currentMouse.x = e.clientX;
        currentMouse.y = e.clientY;
        currentMouse.pointerId = e.pointerId;

        const innerCard = dragElement.querySelector('.drag-item');
        const rect = innerCard.getBoundingClientRect();

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        mirrorElement = innerCard.cloneNode(true);
        mirrorElement.style.position = 'fixed';
        mirrorElement.style.top = `${rect.top}px`;
        mirrorElement.style.left = `${rect.left}px`;
        mirrorElement.style.width = `${rect.width}px`;
        mirrorElement.style.height = `${rect.height}px`;
        mirrorElement.style.pointerEvents = 'none';
        mirrorElement.classList.add('z-[9999]', 'shadow-2xl', 'border-blue-500', 'bg-white/95', 'scale-[1.03]', 'transition-transform', 'duration-100');
        
        document.body.appendChild(mirrorElement);
        innerCard.classList.add('opacity-40', 'bg-slate-100', 'border-dashed', 'border-slate-300');
        document.body.style.cursor = 'grabbing';
    });

    bookSequenceList.addEventListener('pointermove', (e) => {
        if (!dragElement || !mirrorElement) return;
        currentMouse.x = e.clientX;
        currentMouse.y = e.clientY;
        updateDragPositionAndSorting();

        const listRect = bookSequenceList.getBoundingClientRect();
        const scrollThreshold = 35;
        const distanceFromTop = currentMouse.y - listRect.top;
        const distanceFromBottom = listRect.bottom - currentMouse.y;
        let scrollDirection = 0;

        if (distanceFromTop < scrollThreshold && bookSequenceList.scrollTop > 0) scrollDirection = -1;
        else if (distanceFromBottom < scrollThreshold && (bookSequenceList.scrollTop + listRect.height < bookSequenceList.scrollHeight)) scrollDirection = 1;

        if (scrollDirection !== 0) {
            if (!autoScrollFrameId) {
                const performAutoScroll = () => {
                    if (!dragElement || !mirrorElement) return;
                    bookSequenceList.scrollTop += scrollDirection * 6;
                    updateDragPositionAndSorting();
                    autoScrollFrameId = requestAnimationFrame(performAutoScroll);
                };
                autoScrollFrameId = requestAnimationFrame(performAutoScroll);
            }
        } else if (autoScrollFrameId) {
            cancelAnimationFrame(autoScrollFrameId);
            autoScrollFrameId = null;
        }
    });

    const handlePointerUpOrCancel = (e) => {
        if (!dragElement) return;
        if (autoScrollFrameId) { cancelAnimationFrame(autoScrollFrameId); autoScrollFrameId = null; }
        
        try { bookSequenceList.releasePointerCapture(e.pointerId); } catch (err) { }
        
        if (mirrorElement) { mirrorElement.remove(); mirrorElement = null; }
        
        const innerCard = dragElement.querySelector('.drag-item');
        if (innerCard) innerCard.classList.remove('opacity-40', 'bg-slate-100', 'border-dashed', 'border-slate-300');
        document.body.style.cursor = '';

        const finalDomRows = [...bookSequenceList.querySelectorAll('.drag-row')];
        const newOrderOfIndices = finalDomRows.map(row => Number(row.dataset.index));

        onReorder(newOrderOfIndices);
        
        dragElement = null;
    };

    bookSequenceList.addEventListener('pointerup', handlePointerUpOrCancel);
    bookSequenceList.addEventListener('pointercancel', handlePointerUpOrCancel);

    bookSequenceList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-btn');
        if (removeBtn) {
            onRemove(Number(removeBtn.dataset.index));
        }
    });
}