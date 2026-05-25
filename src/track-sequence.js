import { updateTrackSequenceUI, showDialog } from "./ui.js";
/*
    Masechet sequence list logic
*/

// Adds the selected masechet into the Track's masechet sequence list
export function addToSequence(sequence) {
    const val = document.getElementById('masechetSelect').value;
    sequence.push(val);
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
