const gematriaMap = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
};


// Converts Hebrew numeral into its corresponding gematria
export function hebrewToNumber(str) {
    let sum = 0;
    for (let char of str) { if (gematriaMap[char]) sum += gematriaMap[char]; }
    return sum;
}

// Converts a number into its corresponding Hebrew numeral
export function numberToHebrew(num) {
    if (num <= 0) return "";

    // Handle thousands recursively
    if (num >= 1000) {
        return numberToHebrew(Math.floor(num / 1000)) + numberToHebrew(num % 1000);
    }

    // Special cases for 15 and 16
    if (num === 15) return "טו";
    if (num === 16) return "טז";

    let result = "";
    const keys = Object.keys(gematriaMap).sort((a, b) => gematriaMap[b] - gematriaMap[a]);

    for (let char of keys) {
        let value = gematriaMap[char];
        while (num >= value) {
            result += char;
            num -= value;
        }
    }
    return result;
}

// Formats a Hebrew numeral based on the syntactical rules
export function formatGematria(num, rawHebrew) {
    if (!rawHebrew) return "";

    let result = rawHebrew;

    // 1. Handle Thousands Apostrophe
    // If > 1000, find the index where thousands end and rest begins
    if (num >= 1000) {
        const thousandPartLen = numberToHebrew(Math.floor(num / 1000)).length;
        result = result.slice(0, thousandPartLen) + "׳" + result.slice(thousandPartLen);
    }

    // 2. Handle Gershayim (Double tick) or Geresh (Single tick) for the remainder
    const remainder = num % 1000;
    if (remainder > 0) {
        // If the remainder is a single letter, add a single tick (e.g., 5000 + 3 = ה׳ג׳)
        // If the remainder is multiple letters, add double tick before last letter (e.g., ה׳תשפ״ד)
        const output = numberToHebrew(remainder);

        if (output.length === 1) {
            result += "׳";
        } else {
            // Insert " before the last character
            const lastTickIndex = result.length - 1;
            result = result.slice(0, lastTickIndex) + "״" + result.slice(lastTickIndex);
        }
    }

    return result;
}
