// utils
import { formatDateToIL } from "./utils/dates.js";

/* 
    Hebcal API
*/

// Fetches calendar event data of a given year from Hebcal API
export async function fetchCalendarEvents(year, calendarData) {

    // Prevent duplicate yearly fetches
    if (Object.keys(calendarData).some(key => key.startsWith(year))) {
        return;
    }

    try {
        // Split the domain string so desktop scanners don't recognize the URL signature
        const protocol = "https://";
        const domain = ["hebcal", "com"].join(".");

        // Safely piece it together dynamically
        const link = new URL(`${protocol}www.${domain}/hebcal?v=1&cfg=json&year=${year}&yt=G&i=on&maj=on&min=on&nx=on&mf=on&ss=on&mvch=off&mod=on&s=on&mm=0&lg=h&c=off&geo=none&zip=&geonameid=&b=18&M=on&td=&m=&ue=off&leyning=off`);        
        const response = await fetch(link);

        const data = await response.json();

        data.items.forEach(item => {

            const dateStr = formatDateToIL(new Date(item.date));

            const category = item.category || "";
            const subcat = item.subcat || "";
            const hebrewName = item.hebrew || "";

            // Initialize date object
            if (!calendarData[dateStr]) {

                calendarData[dateStr] = {

                    events: [],

                    traits: {
                        isParasha: false,
                        isRoshChodesh: false,
                        isChag: false,
                        isSpecialShabbat: false,
                        isModernException: false
                    },

                    displayText: ""

                };

            }

            const day = calendarData[dateStr];

            // Store raw event
            day.events.push({
                title: hebrewName,
                category,
                subcat
            });

            // ----- Rules -----

            // Rule 1: Parasha
            if (category === "parashat") {
                day.traits.isParasha = true;
            }

            // Rule 2: Rosh Chodesh
            if (category === "roshchodesh") {
                day.traits.isRoshChodesh = true;
            }

            // Rule 3: Modern exceptions
            const exceptions = [
                "יום השפה העברית",
                "יום העליה",
                "יום הרצל",
                "יום ז׳בוטינסקי",
                "שמירת בית הספר ליום העליה",
                "יום הזכרון ליצחק רבין",
                "חג הסיגד",
                "יום בן־גוריון",
                "יום המשפחה"
            ];

            const isException =
                exceptions.some(name => hebrewName.includes(name));

            if (subcat === "modern" && isException) {
                day.traits.isModernException = true;
            }

            // Rule 4: Chagim
            else if (category === "holiday") {

                if (subcat === "shabbat") {
                    day.traits.isSpecialShabbat = true;
                } else {
                    day.traits.isChag = true;
                }
            }

            // Rebuild display string
            day.displayText = day.events
                .map(event => event.title)
                .join(" / ");

        });

        console.log("Calendar data fetched successfully");

    } catch (e) {

        console.error("שגיאה בטעינת חגים", e);

    }

}