import { updateTrackSequenceUI } from "./ui.js";
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
export function clearSequence(sequence) {
    if (confirm("האם למחוק את כל המסכתות מהמסלול?")) {
        sequence = [];
        updateTrackSequenceUI(sequence);
    }
    return sequence;
}
