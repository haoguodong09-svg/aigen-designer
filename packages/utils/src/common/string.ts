/**
 * 生成一个用不重复的ID
 * @param randomLength 随机id长度 0 - 11
 */
export function getUUID(randomLength = 6): string {
  const bytes = new Uint8Array(randomLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36))
    .join('')
    .slice(0, randomLength);
}

/**
  将字符串的首字母大写
  @param str 待处理字符串
  @returns string 首字母大写后的字符串
  */
export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 从 URL 中提取文件名
 * @param url - 包含文件名的 URL
 * @returns 提取的文件名，如果没有则返回空字符串
 */
export function getFileNameByUrl(url: string): string {
  // 找到最后一个斜杠的位置
  const lastSlashIndex = url.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    // 如果没有斜杠，返回整个 URL
    return url;
  }
  // 提取斜杠后面的部分
  const fileName = url.slice(lastSlashIndex + 1);
  return fileName;
}
