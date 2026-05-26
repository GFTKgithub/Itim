import { numberToHebrew } from "./gematria.js";

// Takes an amud index and converts it to a Daf and Amud string
export function indexToDaf(index) {
    const dafNum = Math.floor(index / 2) + 2;
    const amud = (index % 2 === 0) ? "." : ":";
    return `${numberToHebrew(dafNum)}${amud}`;
}
