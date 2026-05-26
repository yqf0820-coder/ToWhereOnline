const KEY = 'towhere_user_profile';

const DEFAULT = {
  name1: '',   // 女
  name2: '',   // 男
  metYear: '',
  metMonth: '',
  metDay: '',
  relYear: '',
  relMonth: '',
  relDay: '',
  setup: false,
};

export function getProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

export function saveProfile(data) {
  const profile = { ...getProfile(), ...data, setup: true };
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export function hasProfile() {
  return getProfile().setup;
}
