/**
 * Preferences management command
 */

import { loadUserConfig, saveUserConfig } from '../lib/config.js';

interface PrefsOptions {
  user: string;
  show?: boolean;
  excludeTopic?: string[];
  boostTopic?: string[];
  setLens?: string;
  setTone?: string;
}

export async function prefs(options: PrefsOptions): Promise<void> {
  const config = await loadUserConfig(options.user);
  
  if (options.show) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  
  let modified = false;
  
  if (options.excludeTopic) {
    config.topics.exclude = [...new Set([...config.topics.exclude, ...options.excludeTopic])];
    console.log(`Added to exclude list: ${options.excludeTopic.join(', ')}`);
    modified = true;
  }
  
  if (options.boostTopic) {
    config.topics.boost = [...new Set([...config.topics.boost, ...options.boostTopic])];
    console.log(`Added to boost list: ${options.boostTopic.join(', ')}`);
    modified = true;
  }
  
  if (options.setLens) {
    config.editorial.lens = options.setLens;
    console.log('Updated editorial lens');
    modified = true;
  }
  
  if (options.setTone) {
    config.editorial.tone = options.setTone;
    console.log('Updated editorial tone');
    modified = true;
  }
  
  if (modified) {
    await saveUserConfig(options.user, config);
    console.log('Preferences saved');
  } else {
    console.log('No changes specified. Use --show to view current preferences.');
  }
}
