export async function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode) — ignore
  }
}

export async function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
