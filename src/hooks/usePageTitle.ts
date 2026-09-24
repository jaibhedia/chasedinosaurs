import { useEffect } from 'react';
import { SITE } from '@/config';

/** Per-screen tab title, so two test windows side by side are tellable apart. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE.name}` : `${SITE.name} | Grab the egg. Survive the chase.`;
  }, [title]);
}
