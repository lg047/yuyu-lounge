const PREFIX = "yuyu.arcade.";

export const store = {
  getNumber(key: string, fallback = 0): number {
    const v = localStorage.getItem(PREFIX + key);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  },
  setNumber(key: string, value: number) {
    localStorage.setItem(PREFIX + key, String(Math.floor(value)));
  },
  getBool(key: string, fallback = false): boolean {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : v === "1";
  },
  setBool(key: string, value: boolean) {
    localStorage.setItem(PREFIX + key, value ? "1" : "0");
  }
};
