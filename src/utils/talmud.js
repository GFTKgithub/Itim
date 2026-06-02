import { numberToHebrew, hebrewToNumber } from "./gematria.js";
import { talmud_bavli_masechtot } from "../data.js";

// Takes an amud index and converts it to a Daf and Amud string
export function indexToDaf(index) {
    const dafNum = Math.floor(index / 2) + 2;
    const amud = (index % 2 === 0) ? "." : ":";
    return `${numberToHebrew(dafNum)}${amud}`;
}

// Gets the number of total amudim from a book name by looking it up in the data array and applying the formula
export function getTotalAmudim(bookName) {
    const book = talmud_bavli_masechtot.find(m => m.name === bookName);
    if (!book) return 0;
    const dafNum = hebrewToNumber(book.end.daf);
    let total = (dafNum * 2) - 2;
    if (book.end.amud === "א") total -= 1;
    return total;
}