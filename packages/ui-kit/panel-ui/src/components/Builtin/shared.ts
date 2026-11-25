export interface SelectOption {
  label: string;
  value: string;
}

/**
 * 将字符串选项列表转换为 select 控件所需的 { label, value } 数组。
 */
export function createSelectOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ label: value, value }));
}

export const DEFAULT_IMG_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='4' fill='%23f3f4f6'/%3E%3Cpath d='M32 86l20-24 15 17 11-13 18 20H32z' fill='%23d1d5db'/%3E%3Ccircle cx='44' cy='42' r='8' fill='%23d1d5db'/%3E%3C/svg%3E";
