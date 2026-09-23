import bridge from '@vkontakte/vk-bridge';

let bridgeReady = false;

export type ShareMode = 'story' | 'wall';

export async function initVK(): Promise<void> {
  try {
    await bridge.send('VKWebAppInit');
    bridgeReady = true;
  } catch {
    bridgeReady = false;
  }
}

async function supports(method: string): Promise<boolean> {
  if (!bridgeReady) return false;
  try {
    return Boolean(await (bridge.supportsAsync as unknown as (m: string) => Promise<boolean>)(method));
  } catch {
    return false;
  }
}

function absoluteAsset(path: string): string {
  return new URL(path.replace(/^\//, ''), window.location.href).toString();
}

function appLink(): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  return url.toString();
}

function buildWallMessage(name: string, link: string): string {
  return \`Я — \${name}. Узнай и ты, кто ты из учеников Академии. \${link}\`;
}

async function browserShare(title: string, text: string, url: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

export async function shareResult(name: string, storyAsset: string, wallAsset: string, mode: ShareMode): Promise<'shared' | 'copied'> {
  const link = appLink();

  if (mode === 'story' && await supports('VKWebAppShowStoryBox')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowStoryBox', {
        background_type: 'image',
        url: absoluteAsset(storyAsset),
        locked: true,
        attachment: {
          text: 'open',
          type: 'url',
          url: link,
        },
      });
      return 'shared';
    } catch {
      // fall through
    }
  }

  if (mode === 'wall' && await supports('VKWebAppShowWallPostBox')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowWallPostBox', {
        message: buildWallMessage(name, link),
        attachments: link,
        upload_attachments: [absoluteAsset(wallAsset)],
      });
      return 'shared';
    } catch {
      // fall through
    }
  }

  if (await supports('VKWebAppShare')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShare', { link });
      return 'shared';
    } catch {
      // fall through
    }
  }

  const text = mode === 'story'
    ? 'Кто ты из учеников Академии? Пройди испытание.'
    : \`Я — \${name}. Узнай и ты, кто ты из учеников Академии.\`;
  return browserShare(\`Я — \${name}\`, text, link);
}

export async function inviteFriend(): Promise<'shared' | 'copied'> {
  if (await supports('VKWebAppShowInviteBox')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShowInviteBox');
      return 'shared';
    } catch {
      // fall through
    }
  }

  const link = appLink();
  if (await supports('VKWebAppShare')) {
    try {
      await (bridge.send as unknown as (method: string, params?: unknown) => Promise<unknown>)('VKWebAppShare', { link });
      return 'shared';
    } catch {
      // fall through
    }
  }
  return browserShare('Академия ждёт', 'Попробуй пройти испытание и узнать, кто ты из учеников Академии.', link);
}
