# Itim (עיתים) — Dynamic Torah Study Scheduler and Tracker
Itim is a fast, lightweight calendar and scheduling builder designed to help people map out their learning goals for central Jewish texts and encourage them to set times for Torah study (לקבוע עיתים לתורה). 
It’s written completely in native vanilla JavaScript with zero clunky dependencies.

Whether you want to finish a book by a specific target date or set a steady daily pace, Itim handles all the complex Hebrew-Gregorian date math behind the scenes to keep your schedule flawless.

---

## The Core Philosophy
Instead of generating a massive, rigid schedule and dumping thousands of rows into a database, Itim calculates your calendar locally, in real-time. Your database only needs to store basic user preferences, settings, and manual adjustments. The schedule itself is built instantly on the fly.

This approach keeps the app fast, keeps cloud hosting costs near zero, and makes it incredibly easy to adapt to your life when things change and ensure Torah study remains the most pleasant and accessible experience possible.

---

## What's Built & What's Coming
### What works right now (The MVP)
* Smart Content Mapping: It converts your book tracks into individual learning units (Amudim) so it can map your daily goals across text boundaries seamlessly.

* Two Schedule Modes: Choose a Target Date (e.g., "I want to finish these three books by next Passover") and it will mathematically split up the work, or choose a Daily Pace (e.g., "I want to learn 1 page a day") and it will project your exact completion date.

* Built-in Breaks & Reviews: Automatically injects structured rest days (like holidays or weekends) and dedicated review (Chazarah) days right after you finish a book.

* Manual Overrides: Click any day to manually force a break or force a study session, and watch the rest of the calendar instantly shift to compensate.

* Syncing Foundations: Basic local storage, account logins, and Firebase syncing are already under the hood and talking to each other.

* Persistence: Beyond the syncing methods, there are options to export a generated calendar to excel, print it out or backup export/import the entire configuration to your device.

### What's coming next
* The "Eifo Ata Ochez" Engine: Soon, you'll be able to save your original calendar as a "baseline." If you get sick, take an unexpected trip, or fall behind, a single button will let you update the app where you're currently holding in your study and it will "refit" your plan from that point forward to get you back on track smoothly.

* Beyond Talmud Bavli: The current version is focused entirely on the Talmud, but we are expanding the data structures to support all central Jewish texts (Mishnah, Shulchan Aruch, Tanakh, etc.), each with its own custom settings.

* Multi-track Support: Currently, you can only define one study sequence at once. In the near future, it will be possible to track multiple unrelated tracks at once so your Seders are fully organized.

* Multi-user Interactions: Further down the list, we will incorporate online networking, allowing you to connect with other users, create charutot and share siyum dates.

* And many other things! Stay tuned to learn more.

---

## Want to give us feedback?

Share your bug reports, feature request and other ideas here in this form:
https://tally.so/r/44zqkO


–Itim