const API = 'https://api.telegram.org';
const TIMEOUT_MS = 20_000;

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

export class TelegramError extends Error {}

async function call<T>(token: string, method: string, body?: FormData | Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const isForm = body instanceof FormData;
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json()) as TelegramResponse<T>;
    if (!json.ok || json.result === undefined) throw new TelegramError(translate(json.description ?? `HTTP ${res.status}`));
    return json.result;
  } catch (e) {
    if (e instanceof TelegramError) throw e;
    throw new TelegramError(controller.signal.aborted ? 'Telegram no respondió a tiempo. Revisa la conexión a internet.' : 'Sin conexión con Telegram. Revisa el internet de la tablet.');
  } finally {
    clearTimeout(timer);
  }
}

function translate(description: string) {
  if (/unauthorized/i.test(description)) return 'El token del bot no es válido.';
  if (/chat not found/i.test(description)) return 'No se encontró el chat. Escríbele /start al bot y vuelve a detectarlo.';
  if (/blocked by the user/i.test(description)) return 'El admin bloqueó al bot en Telegram.';
  return description;
}

export function getBot(token: string) {
  return call<{ id: number; username: string; first_name: string }>(token, 'getMe');
}

type Update = { update_id: number; message?: { text?: string; chat: { id: number; type: string; first_name?: string; last_name?: string; title?: string } } };

/** The most recent chat that wrote /start to the bot, used as the admin's chat. */
export async function findStartChat(token: string) {
  const updates = await call<Update[]>(token, 'getUpdates', { allowed_updates: ['message'] });
  const start = [...updates].reverse().find((u) => u.message?.text?.trim().startsWith('/start'));
  if (!start?.message) return null;
  const chat = start.message.chat;
  const name = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ');
  return { id: String(chat.id), name: name || 'Chat de Telegram' };
}

/** Telegram allows 4096 characters per message. */
export function sendText(token: string, chatId: string, text: string) {
  return call(token, 'sendMessage', { chat_id: chatId, text: text.slice(0, 4096), disable_web_page_preview: true });
}

/** Sends a local file (`file://`) as a document or photo, with an optional caption (max 1024 characters). */
export function sendFile(token: string, chatId: string, file: { uri: string; name: string; type: string }, as: 'document' | 'photo', caption?: string) {
  const form = new FormData();
  form.append('chat_id', chatId);
  // React Native's FormData uploads `{ uri, name, type }` objects as files.
  form.append(as, file as unknown as Blob);
  if (caption) form.append('caption', caption.slice(0, 1024));
  return call(token, as === 'photo' ? 'sendPhoto' : 'sendDocument', form);
}
