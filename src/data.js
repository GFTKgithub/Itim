import { hebrewToNumber } from "./utils.js";

// Data for all masechtot
export const masechtot = [
    // Zeraim
    { name: "ברכות", end: { daf: "סד", amud: "א" } },

    // Moed
    { name: "שבת", end: { daf: "קנז", amud: "ב" } },
    { name: "עירובין", end: { daf: "קה", amud: "א" } },
    { name: "פסחים", end: { daf: "קכא", amud: "א" } },
    { name: "יומא", end: { daf: "פח", amud: "א" } },
    { name: "סוכה", end: { daf: "נו", amud: "א" } },
    { name: "ביצה", end: { daf: "מ", amud: "א" } },
    { name: "ראש השנה", end: { daf: "לה", amud: "א" } },
    { name: "תענית", end: { daf: "לא", amud: "א" } },
    { name: "מגילה", end: { daf: "לב", amud: "א" } },
    { name: "מועד קטן", end: { daf: "כח", amud: "ב" } },
    { name: "חגיגה", end: { daf: "כז", amud: "א" } },

    // Nashim
    { name: "יבמות", end: { daf: "קכב", amud: "א" } },
    { name: "כתובות", end: { daf: "קיב", amud: "ב" } },
    { name: "נדרים", end: { daf: "צא", amud: "א" } },
    { name: "נזיר", end: { daf: "סו", amud: "ב" } },
    { name: "סוטה", end: { daf: "מט", amud: "א" } },
    { name: "גיטין", end: { daf: "צ", amud: "א" } },
    { name: "קידושין", end: { daf: "פב", amud: "א" } },

    // Nezikin
    { name: "בבא קמא", end: { daf: "קיט", amud: "א" } },
    { name: "בבא מציעא", end: { daf: "קיט", amud: "א" } },
    { name: "בבא בתרא", end: { daf: "קעו", amud: "א" } },
    { name: "סנהדרין", end: { daf: "קיג", amud: "א" } },
    { name: "מכות", end: { daf: "כד", amud: "א" } },
    { name: "שבועות", end: { daf: "מט", amud: "א" } },
    { name: "עבודה זרה", end: { daf: "עו", amud: "א" } },
    { name: "הוריות", end: { daf: "יד", amud: "א" } },

    // Kodashim
    { name: "זבחים", end: { daf: "קכ", amud: "א" } },
    { name: "מנחות", end: { daf: "קי", amud: "א" } },
    { name: "חולין", end: { daf: "קמב", amud: "א" } },
    { name: "בכורות", end: { daf: "סא", amud: "א" } },
    { name: "ערכין", end: { daf: "לד", amud: "א" } },
    { name: "תמורה", end: { daf: "לד", amud: "א" } },
    { name: "כריתות", end: { daf: "כח", amud: "א" } },
    { name: "מעילה", end: { daf: "כב", amud: "א" } },
    { name: "תמיד", end: { daf: "לג", amud: "ב" } },

    // Tahorot
    { name: "נדה", end: { daf: "עג", amud: "א" } }
];

export 
// Gets the number of total amudim from a masechet
function getTotalAmudim(masechetName) {
    const masechet = masechtot.find(m => m.name === masechetName);
    if (!masechet) return 0;
    const dafNum = hebrewToNumber(masechet.end.daf);
    let total = (dafNum * 2) - 2;
    if (masechet.end.amud === "א") total -= 1;
    return total;
}