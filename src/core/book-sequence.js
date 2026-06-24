import { talmud_bavli_masechtot } from "./data.js";

/*
    Book sequence list logic — PURE DATA OPERATIONS ONLY
    No DOM access, no UI imports, no dialog calls.
*/

export function addToSequence(sequence, bookName) {
    if (!bookName) return sequence;

    // 1. Find the real data object from your database array
    const bookData = talmud_bavli_masechtot.find(m => m.name === bookName);

    // 2. Safely read total amudim, default to 120 if missing
    const totalAmudim = bookData && bookData.amudCount ? bookData.amudCount : 120;

    // 3. Construct our dynamic tracker state structure
    const newBookEntry = {
        name: bookName,
        reviewDays: 0,
        amudStates: new Array(totalAmudim).fill(0)
    };

    // 4. Mutate and return
    sequence.push(newBookEntry);
    return sequence;
}

// Removes the selected book from the book sequence list
export function removeFromSequence(sequence, index) {
    sequence.splice(index, 1);
    return sequence;
}

// Clears the entire sequence of books — pure data, no dialog
export function clearSequence(sequence) {
    return [];
}