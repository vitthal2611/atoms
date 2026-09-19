import { getFunctions, httpsCallable } from "firebase/functions";
import { getFreqLabel } from "../utils/scheduleUtils.js";

/**
 * Fetch AI-generated field suggestion for habit improvement
 */
export async function fetchFieldSuggestion(habit, identityLabel, field) {
  try {
    const call = httpsCallable(getFunctions(), "askJamesClear", { timeout: 20000 });
    
    const res = await call({
      mode: "field",
      field,
      habit: {
        label: habit.label,
        identity: identityLabel,
        trigger: habit.trigger,
        attractive: habit.attractive,
        easy: habit.easy,
        starter: habit.starter,
        satisfying: habit.satisfying,
        time: habit.time,
        location: habit.location,
        frequency: getFreqLabel(habit.frequency),
      },
    });
    
    const value = String(res?.data?.suggestion?.value || "").trim();
    if (!value) return null;
    
    return {
      value,
      note: String(res?.data?.suggestion?.note || "").trim()
    };
  } catch {
    return null; // Offline, over quota, or cold start
  }
}
