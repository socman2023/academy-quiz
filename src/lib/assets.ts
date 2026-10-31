/** Resolve assets stored in /public for both VK hosting and GitHub Pages. */
export function publicAssetUrl(path: string): string {
  const relativePath = path.replace(/^\/+/, '');
  return new URL(`${import.meta.env.BASE_URL}${relativePath}`, window.location.href).toString();
}
