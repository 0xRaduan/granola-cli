import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface TokenData {
  access_token?: string;
  refresh_token?: string;
  client_id?: string;
}

interface SupabaseConfig {
  workos_tokens?: string;
  cognito_tokens?: string;
  user_info?: string | Record<string, unknown>;
}

const SUPABASE_PATHS = {
  darwin: join(homedir(), 'Library/Application Support/Granola/supabase.json'),
  linux: join(homedir(), '.config/Granola/supabase.json'),
  win32: join(homedir(), 'AppData/Roaming/Granola/supabase.json'),
};

export function getSupabasePath(): string {
  if (process.env.GRANOLA_CREDENTIALS) {
    return process.env.GRANOLA_CREDENTIALS;
  }
  const platform = process.platform as keyof typeof SUPABASE_PATHS;
  return SUPABASE_PATHS[platform] || SUPABASE_PATHS.darwin;
}

export function extractAccessToken(): string {
  const supabasePath = getSupabasePath();
  const raw = readFileSync(supabasePath, 'utf8');
  const config: SupabaseConfig = JSON.parse(raw);

  const candidates = [config.workos_tokens, config.cognito_tokens];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const tokenData: TokenData = JSON.parse(candidate);
      if (tokenData.access_token) return tokenData.access_token;
    } catch {
      continue;
    }
  }

  throw new Error('No valid access token found in supabase.json.');
}

export function readUserInfo(): Record<string, unknown> | null {
  try {
    const supabasePath = getSupabasePath();
    const raw = readFileSync(supabasePath, 'utf8');
    const config: SupabaseConfig = JSON.parse(raw);
    if (!config.user_info) return null;
    if (typeof config.user_info === 'string') {
      return JSON.parse(config.user_info);
    }
    return config.user_info as Record<string, unknown>;
  } catch {
    return null;
  }
}
