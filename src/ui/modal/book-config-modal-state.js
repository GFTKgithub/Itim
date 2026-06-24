/**
 * Book Config Modal State
 * 
 * Encapsulates all mutable state for the book configuration modal,
 * separating concerns from both the DOM (setup/) and rendering (ui/).
 */
export function createBookConfigModalState() {
    let currentEditingIndex = null;
    let tempAmudStates = [];
    let currentDaySlots = [];
    let isBunchedView = false;

    return {
        /** Open the modal for a specific book index */
        open: function (index, amudStates, daySlots) {
            currentEditingIndex = index;
            tempAmudStates = [...amudStates];
            currentDaySlots = [...daySlots];
            isBunchedView = false;
        },

        /** Close the modal */
        close: function () {
            currentEditingIndex = null;
            tempAmudStates = [];
            currentDaySlots = [];
            isBunchedView = false;
        },

        /** Getters */
        getEditingIndex: () => currentEditingIndex,
        getAmudStates: () => tempAmudStates,
        getDaySlots: () => currentDaySlots,
        getIsBunchedView: () => isBunchedView,

        /** Amud state toggle */
        toggleAmudState: function (idx) {
            if (isBunchedView) {
                const partnerIdx = (idx % 2 === 0) ? idx + 1 : idx - 1;
                const nextState = (tempAmudStates[idx] + 1) % 3;
                tempAmudStates[idx] = nextState;
                if (partnerIdx >= 0 && partnerIdx < tempAmudStates.length) {
                    tempAmudStates[partnerIdx] = nextState;
                }
            } else {
                tempAmudStates[idx] = (tempAmudStates[idx] + 1) % 3;
            }
        },

        /** Daily view slot toggle */
        toggleDaySlot: function (slotIdx) {
            const slot = currentDaySlots[slotIdx];
            if (!slot) return;

            let learnedCount = 0, skippedCount = 0;
            for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                if (i < tempAmudStates.length) {
                    if (tempAmudStates[i] === 1) learnedCount++;
                    else if (tempAmudStates[i] === 2) skippedCount++;
                }
            }
            const newState = (learnedCount === slot.amudCount) ? 2 : (skippedCount === slot.amudCount) ? 0 : 1;
            for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                if (i < tempAmudStates.length) tempAmudStates[i] = newState;
            }
        },

        /** Mark today's slot */
        markToday: function (todayStr) {
            const slot = currentDaySlots.find(s => s.dateString === todayStr);
            if (!slot) return false;

            let learnedCount = 0, skippedCount = 0;
            for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                if (i < tempAmudStates.length) {
                    if (tempAmudStates[i] === 1) learnedCount++;
                    else if (tempAmudStates[i] === 2) skippedCount++;
                }
            }
            const isFullyLearned = learnedCount === slot.amudCount;
            const isFullySkipped = skippedCount === slot.amudCount;
            const newState = isFullyLearned ? 2 : isFullySkipped ? 0 : 1;

            for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                if (i < tempAmudStates.length) tempAmudStates[i] = newState;
            }
            return true;
        },

        /** Set view mode */
        setViewMode: function (view) {
            if (view === 'bunched') {
                isBunchedView = true;
            } else {
                isBunchedView = false;
            }
        }
    };
}