import { updateTrackSequenceUI, showDialog } from "./ui.js";
import { masechtot } from "./data.js"; // Import the data to get page counts

/*
    Masechet sequence list logic
*/

export function addToSequence(sequence) {
    const selectEl = document.getElementById('masechetSelect');
    const selectedName = selectEl.value;

    if (!selectedName) return sequence;

    // 1. Find the real data object from your database array
    const masechetData = masechtot.find(m => m.name === selectedName);

    // 2. Safely read total amudim, default to 120 if missing
    const totalAmudim = masechetData && masechetData.amudCount ? masechetData.amudCount : 120;

    // 3. Construct our dynamic tracker state structure
    const newMasechetEntry = {
        name: selectedName,
        reviewDays: 0,
        // Array dynamically scaled exactly to this masechet's volume layout
        amudStates: new Array(totalAmudim).fill(0)
    };

    // 4. Update the tracker array state memory reference
    sequence.push(newMasechetEntry);

    // 5. Fire your beautiful UI rendering pipeline
    updateTrackSequenceUI(sequence);

    return sequence;
}

// Removes the selected masechet from the Track's masechet sequence list
export function removeFromSequence(sequence, index) {
    sequence.splice(index, 1);
    updateTrackSequenceUI(sequence);
    return sequence;
}

// Clears the entire sequence of masechtot from the Track's masechet sequence list
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
        updateTrackSequenceUI(sequence);
    }
    return sequence;
}
