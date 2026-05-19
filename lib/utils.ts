/**
 * Converts a Google Drive sharing link to a direct download link.
 * @param url The URL to convert.
 * @returns The direct download URL if it's a Google Drive link, otherwise the original URL.
 */
export const getDownloadUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  // Check if it's a Google Drive link
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/file\/d\/([^\/]+)/) || url.match(/[?&]id=([^&]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }
  return url;
};
