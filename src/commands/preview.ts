/**
 * Preview command - generate newsletter without sending
 */

import { send } from './send.js';

interface PreviewOptions {
  user: string;
  edition?: 'morning' | 'evening' | 'auto';
}

export async function preview(options: PreviewOptions): Promise<void> {
  await send({
    user: options.user,
    edition: options.edition || 'auto',
    dryRun: true
  });
}
