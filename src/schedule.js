import { hebrewToNumber, indexToDaf, formatDateToIL } from './utils.js';
import { getTotalAmudim } from './data.js';


// Calculates if a given date should be rest or study (pre-override)
export function shouldDayBeRest(dateObj, includeShabbat, includeHolidays, calendarData) {
    const dateString = formatDateToIL(dateObj);
    const day = calendarData[dateString];
    const traits = day?.traits || {};
    const isShabbatDay = dateObj.getDay() === 6;

    if (traits.isChag && !includeHolidays)  return true;     // Force break on Standard Chagim
    if ((isShabbatDay || traits.isParasha) 
        && !includeShabbat)                 return true;     // Force break on Shabbat / Parasha

    if (traits.isRoshChodesh)               return false;     // Study by default on Rosh Chodesh
    if (traits.isModernException)           return false;     // Study by default on Modern Exceptions
        
    return false;   // Not rest day by default
}
