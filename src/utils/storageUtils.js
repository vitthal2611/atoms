// Local storage utility functions

/**
 * Get stable device ID for push notifications
 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem("atoms-device-id");
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("atoms-device-id", id);
    }
    return id;
  } catch {
    return "device";
  }
}

/**
 * Load dismissed cues from local storage
 */
export function loadDismissedCues() {
  try {
    return JSON.parse(localStorage.getItem("atoms-dismissed-cues") || "[]");
  } catch {
    return [];
  }
}

/**
 * Save dismissed cues to local storage
 */
export function saveDismissedCues(list) {
  try {
    localStorage.setItem("atoms-dismissed-cues", JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load custom cues from local storage
 */
export function loadCustomCues() {
  try {
    return JSON.parse(localStorage.getItem("atoms-custom-cues") || "[]");
  } catch {
    return [];
  }
}

/**
 * Save custom cues to local storage
 */
export function saveCustomCues(list) {
  try {
    localStorage.setItem("atoms-custom-cues", JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}
