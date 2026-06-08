import { talmud_bavli_masechtot } from "./data.js";

import { updateBookSequenceUI } from "./ui/track-config.js";
import { showDialog } from "./ui/components.js";

/*
    Book sequence list logic
*/

export function addToSequence(sequence) {
    const selectEl = document.getElementById('bookSelect');
    const selectedName = selectEl.value;

    if (!selectedName) return sequence;

    // 1. Find the real data object from your database array
    const bookData = talmud_bavli_masechtot.find(m => m.name === selectedName);

    // 2. Safely read total amudim, default to 120 if missing
    const totalAmudim = bookData && bookData.amudCount ? bookData.amudCount : 120;

    // 3. Construct our dynamic tracker state structure
    const newBookEntry = {
        name: selectedName,
        reviewDays: 0,
        // Array dynamically scaled exactly to this book's volume layout
        amudStates: new Array(totalAmudim).fill(0)
    };

    // 4. Update the tracker array state memory reference
    sequence.push(newBookEntry);

    // 5. Fire your beautiful UI rendering pipeline
    updateBookSequenceUI(sequence);

    return sequence;
}

// Removes the selected book from the book sequence list
export function removeFromSequence(sequence, index) {
    sequence.splice(index, 1);
    updateBookSequenceUI(sequence);
    return sequence;
}

// Clears the entire sequence of books from the book sequence list
export async function clearSequence(sequence) {
    const confirmed = await showDialog({
            title: 'ניקוי רשימת המסכתות במסלול',
            message: 'האם אתה בטוח שברצונך לנקות את רשימת המסכתות במסלול?',
            icon: '🗑️',
            showCancel: true,
            confirmText: 'כן, נקה הכל',
            cancelText: 'לא, התחרטתי'
        });
    if (confirmed) {
        sequence = [];
        updateBookSequenceUI(sequence);
    }
    return sequence;
}
