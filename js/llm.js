/* Dry Run Studio: model providers.
   One small adapter per provider: list the models a key can use (this is also how a key
   is verified) and stream a reply. Calls go through the local server's /proxy when the
   page is served by server.js, otherwise straight from the browser to the provider. */
const LLM = (() => {
  let viaProxy = false;
  const ready = fetch('./__drs', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { viaProxy = !!(j && j.drs); }).catch(() => {});
  const base = id => viaProxy ? './proxy/' + id : PROVIDERS[id].host;

  const fail = (code, message) => ({ code, message });
  async function check(res) {
    if (res.ok) return res;
    let msg = ''; try { const j = await res.json(); msg = (j.error && (j.error.message || j.error)) || j.message || ''; if (typeof msg !== 'string') msg = JSON.stringify(msg); } catch (e) {}
    const code = res.status === 401 || res.status === 403 ? 'bad_key' : res.status === 429 ? 'rate_limited' : res.status === 404 ? 'no_model' : res.status === 400 ? 'bad_request' : res.status >= 500 ? 'provider_down' : 'http_' + res.status;
    throw fail(/api[ _-]?key|authentic|permission/i.test(msg) && res.status === 400 ? 'bad_key' : code, msg);
  }
  async function call(url, opts) {
    await ready;
    try { return await check(await fetch(url, opts)); }
    catch (e) { if (e && e.code) throw e; if (e && e.name === 'AbortError') throw fail('cancelled', ''); throw fail('network', String(e && e.message || e)); }
  }
  /* Read a server-sent-event stream and hand each JSON payload to onEvent. */
  async function sse(res, onEvent, signal) {
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch (e) { continue; }
          onEvent(j);
        }
      }
    } catch (e) { if (e && e.code) throw e; if (signal && signal.aborted) throw fail('cancelled', ''); throw fail('network', String(e && e.message || e)); }
  }
  const json = { 'content-type': 'application/json' };

  const PROVIDERS = {
    anthropic: {
      name: 'Claude', by: 'Anthropic', host: 'https://api.anthropic.com', hint: 'sk-ant-...', keyUrl: 'https://console.anthropic.com/settings/keys',
      headers: k => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }),
      async models(key) {
        const r = await call(base('anthropic') + '/v1/models?limit=100', { headers: this.headers(key) });
        return ((await r.json()).data || []).map(m => ({ id: m.id, label: m.display_name || m.id }));
      },
      prefer: [/fable/i, /opus/i, /sonnet/i],
      async stream(key, model, turns, o) {
        let text = '', cut = false;
        for (const max of [16000, 8000, 4096]) {
          try {
            const r = await call(base('anthropic') + '/v1/messages', { method: 'POST', signal: o.signal, headers: { ...json, ...this.headers(key) }, body: JSON.stringify({ model, max_tokens: max, stream: true, messages: turns }) });
            await sse(r, j => {
              if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') { text += j.delta.text; o.onText && o.onText(text); }
              if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'max_tokens') cut = true;
              if (j.type === 'error') throw fail('provider_down', j.error && j.error.message || '');
            }, o.signal);
            return { text, truncated: cut };
          } catch (e) { if (!(e.code === 'bad_request' && /max_tokens/i.test(e.message) && max > 4096)) throw e; }
        }
      },
    },
    openai: {
      name: 'GPT', by: 'OpenAI', host: 'https://api.openai.com', hint: 'sk-...', keyUrl: 'https://platform.openai.com/api-keys',
      headers: k => ({ authorization: 'Bearer ' + k }),
      async models(key) {
        const r = await call(base('openai') + '/v1/models', { headers: this.headers(key) });
        return ((await r.json()).data || [])
          .filter(m => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !/audio|realtime|image|tts|transcribe|embedding|moderation|search|instruct|whisper|dall|codex|computer/i.test(m.id))
          .sort((a, b) => (b.created || 0) - (a.created || 0)).map(m => ({ id: m.id, label: m.id }));
      },
      prefer: [/^gpt-[\d.]+$/, /^gpt-[\d.]+-\d{4}/, /^gpt-(?!.*(mini|nano))/],
      async stream(key, model, turns, o) {
        let text = '', cut = false;
        for (const fmtJson of o.json ? [true, false] : [false]) {
          try {
            const r = await call(base('openai') + '/v1/chat/completions', { method: 'POST', signal: o.signal, headers: { ...json, ...this.headers(key) },
              body: JSON.stringify({ model, stream: true, messages: turns, ...(fmtJson ? { response_format: { type: 'json_object' } } : {}) }) });
            await sse(r, j => { const c = j.choices && j.choices[0]; if (!c) return; if (c.delta && c.delta.content) { text += c.delta.content; o.onText && o.onText(text); } if (c.finish_reason === 'length') cut = true; }, o.signal);
            return { text, truncated: cut };
          } catch (e) { if (!(fmtJson && e.code === 'bad_request' && /response_format|json/i.test(e.message))) throw e; }
        }
      },
    },
    gemini: {
      name: 'Gemini', by: 'Google', host: 'https://generativelanguage.googleapis.com', hint: 'AIza...', keyUrl: 'https://aistudio.google.com/apikey',
      async models(key) {
        const r = await call(base('gemini') + '/v1beta/models?pageSize=1000&key=' + encodeURIComponent(key), {});
        const ver = id => { const m = id.match(/gemini-(\d+(?:\.\d+)?)/); return m ? +m[1] : 0; };
        return ((await r.json()).models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name) && !/embedding|image|tts|audio|live|vision|aqa|robotics|computer/i.test(m.name))
          .map(m => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
          .sort((a, b) => ver(b.id) - ver(a.id) || (/pro/.test(b.id) - /pro/.test(a.id)) || a.id.length - b.id.length);
      },
      prefer: [/pro(?!.*(preview|exp))/i, /pro/i, /flash(?!.*lite)/i],
      async stream(key, model, turns, o) {
        let text = '', cut = false;
        const contents = turns.map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] }));
        const r = await call(base('gemini') + '/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(key), { method: 'POST', signal: o.signal, headers: json,
          body: JSON.stringify({ contents, ...(o.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) }) });
        await sse(r, j => { const c = j.candidates && j.candidates[0]; if (!c) return; for (const part of (c.content && c.content.parts) || []) if (part.text && !part.thought) { text += part.text; o.onText && o.onText(text); } if (c.finishReason === 'MAX_TOKENS') cut = true; }, o.signal);
        return { text, truncated: cut };
      },
    },
  };

  return {
    PROVIDERS,
    /* Verifies the key by listing the models it can use. Resolves [{id,label}] newest/best first. */
    async verify(provider, key) {
      const list = await PROVIDERS[provider].models(key.trim());
      if (!list.length) throw fail('no_model', 'The key works, but it has no chat models available.');
      return list;
    },
    pick(provider, list) { for (const re of PROVIDERS[provider].prefer) { const m = list.find(x => re.test(x.id)); if (m) return m.id; } return list[0].id; },
    /* turns: [{role:'user'|'assistant', content}] → {text, truncated}. opts: {json, onText(fullText), signal} */
    async ask(conn, turns, opts = {}) {
      const res = await PROVIDERS[conn.provider].stream(conn.key, conn.model, turns, opts);
      if (!res || !res.text.trim()) throw fail('empty', '');
      return res;
    },
    usingProxy: () => viaProxy,
  };
})();
