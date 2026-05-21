import { formatDateToIL } from "./utils.js";

/* 
    Hebcal API
*/

// Fetches calendar event data of a given year from Hebcal API
export async function fetchCalendarEvents(year, calendarEventsData, dayTypesData) {
    if (Object.keys(calendarEventsData).some(key => key.startsWith(year))) return;

    try {
        const response = await fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&yt=G&i=on&maj=on&min=on&nx=on&mf=on&ss=on&mvch=off&mod=on&s=on&mm=0&lg=h&c=off&geo=none&zip=&geonameid=&b=18&M=on&td=&m=&ue=off&leyning=off`);
        const data = await response.json();

        data.items.forEach(item => {
            const dateStr = formatDateToIL(new Date(item.date));
            const category = item.category || "";
            const subcat = item.subcat || "";
            const hebrewName = item.hebrew || "";

            // Initialize day logic traits for this date if not already present
            if (!dayTypesData[dateStr]) {
                dayTypesData[dateStr] = {
                    isParasha: false,
                    isRoshChodesh: false,
                    isChag: false,
                    isModernException: false
                };
            }

            // --- Define Structuring Rules ---

            // Rule 1: Normal Weekly Torah Portions
            if (category === "parashat") {
                dayTypesData[dateStr].isParasha = true;
            }

            // Rule 3: Rosh Chodesh
            if (category === "roshchodesh") {
                dayTypesData[dateStr].isRoshChodesh = true;
            }

            // Rule 5: Modern Day Exceptions List
            const exceptions = [
                "יום השפה העברית", "יום העליה", "יום הרצל", "יום ז׳בוטינסקי",
                "שמירת בית הספר ליום העליה", "יום הזכרון ליצחק רבין",
                "חג הסיגד", "יום בן־גוריון", "יום המשפחה"
            ];
            const isException = exceptions.some(name => hebrewName.includes(name));

            if (subcat === "modern" && isException) {
                dayTypesData[dateStr].isModernException = true;
            }
            // Rule 4: Standard Chagim (Major, Minor, Fast, or standard Modern days not in exception list)
            else if (category === "holiday") {
                if(subcat === "shabbat")
                    dayTypesData[dateStr].isSpecialShabbat = true;
                else dayTypesData[dateStr].isChag = true;
            }

            // Populate text layout normally (keeps multiple labels visible e.g. "ראש חודש / פרשת...")
            if (calendarEventsData[dateStr]) {
                calendarEventsData[dateStr] += " / " + hebrewName;
            } else {
                calendarEventsData[dateStr] = hebrewName;
            }
        });
        console.log("Data successfully fetched from Hebcal API");
    } catch (e) {
        console.error("שגיאה בטעינת חגים", e);
    }
}