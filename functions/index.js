// Scheduled Cloud Function — the piece that makes the daily reminder reach a
// closed phone. Runs every minute, checks whether it's currently each user's
// chosen reminder time (in their own timezone), and sends an FCM push if so.
// The device's browser wakes public/sw.js to display it, even fully closed.
//
// Cost note: for a handful of users this runs comfortably inside Firebase's
// free tier even on the Blaze plan (Blaze is required only because scheduled
// functions depend on Cloud Scheduler, which isn't available on the free
// Spark plan) — expect close to $0/month at personal-project scale.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ── Mirrors isScheduledOn in src/App.jsx — keep in sync if that logic changes ──
function isScheduledOn(frequency, dateKey) {
  const freq = frequency || { cadence: "weekly", days: [0, 1, 2, 3, 4, 5, 6] };
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  if (freq.cadence === "monthly") {
    const dates = freq.dates || [1];
    const lastDay = new Date(y, mo, 0).getDate();
    return dates.some((dt) => (dt === 32 ? d === lastDay : dt === d));
  }
  const jsDay = date.getDay();
  const ourDay = jsDay === 0 ? 6 : jsDay - 1;
  return (freq.days || [0, 1, 2, 3, 4, 5, 6]).includes(ourDay);
}

exports.sendDailyReminders = onSchedule("every 1 minutes", async () => {
  const usersSnap = await db.collection("users").get();
  if (usersSnap.empty) return;

  await Promise.all(
    usersSnap.docs.map(async (userDoc) => {
      const uid = userDoc.id;
      const settingsSnap = await db.doc(`users/${uid}/atomicHabits/settings`).get();
      if (!settingsSnap.exists) return;

      const settings = settingsSnap.data().data || {};
      const { reminderEnabled, reminderTime, fcmToken, timezone } = settings;
      if (!reminderEnabled || !reminderTime || !fcmToken || !timezone) return;

      const now = new Date();
      const nowLocal = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now); // "HH:MM"

      if (nowLocal !== reminderTime) return;

      const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now); // "YYYY-MM-DD"

      const [identitiesSnap, checkInsSnap] = await Promise.all([
        db.doc(`users/${uid}/atomicHabits/identities`).get(),
        db.doc(`users/${uid}/atomicHabits/checkIns`).get(),
      ]);
      const identities = identitiesSnap.exists ? identitiesSnap.data().data || [] : [];
      const todayCheckIns = checkInsSnap.exists
        ? (checkInsSnap.data().data || {})[localDateStr] || {}
        : {};

      const pending = identities
        .flatMap((i) => i.habits || [])
        .filter((h) => isScheduledOn(h.frequency, localDateStr) && !todayCheckIns[h.id]).length;

      const body =
        pending > 0
          ? `${pending} habit${pending === 1 ? "" : "s"} waiting — every check-in is a vote for who you're becoming.`
          : "Nothing left today — nice work. See you tomorrow.";

      try {
        await messaging.send({
          token: fcmToken,
          notification: { title: "Atomic Habits", body },
          webpush: { fcmOptions: { link: "/" } },
        });
      } catch (err) {
        console.error(`Push failed for ${uid}:`, err.message);
      }
    })
  );
});
