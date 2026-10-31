/** Detect the VK Mini App container without treating ordinary browsers as VK. */
export function isVKContext(): boolean {
  const { hostname, search } = window.location;
  return /^(?:prod|stage)-app\d+/.test(hostname)
    || new URLSearchParams(search).has('vk_app_id');
}
