(function () {
  'use strict';

  // Скрипт часто вставляют в <head> (Tilda). Нельзя трогать body до его появления.
  // Флаг ставим только после успешного монтирования — иначе повторный T123 молчит.
  if (window.__boatSochiBotLoaded) return;

  var scriptEl = document.currentScript;
  var API_BASE = '';
  if (scriptEl && scriptEl.src) {
    try {
      API_BASE = new URL(scriptEl.src).origin;
    } catch (e) {
      API_BASE = '';
    }
  }
  if (!API_BASE) API_BASE = 'https://boat.webtaxi2.ru';

  function onReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      setTimeout(fn, 0);
    }
  }

  function getSessionId() {
    var SESSION_KEY = 'boat_sochi_bot_session';
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'w_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return 'w_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  function mount() {
    if (window.__boatSochiBotLoaded) return;
    if (!document.body) return;
    window.__boatSochiBotLoaded = true;

    var sessionId = getSessionId();
    var messages = [];
    var open = false;
    var sending = false;
    var botName = 'Boat Sochi';
    var greeting =
      'Здравствуйте! Помогу выбрать катер или яхту.\nБосс Олег часто в море — связь может быть слабой. Мадам Наталья: +7 918 304-40-00. Спрашивайте — или оставите контакт, свяжемся )';

    var style = document.createElement('style');
    style.textContent = [
      '#bsb-root{all:initial;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;position:fixed !important;z-index:2147483000 !important;right:20px !important;bottom:20px !important;left:auto !important;top:auto !important;width:auto !important;height:auto !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;color:#0f172a}',
      '#bsb-root *{box-sizing:border-box;font-family:inherit}',
      '#bsb-btn{width:56px !important;height:56px !important;border:0 !important;border-radius:50% !important;cursor:pointer;background:#0ea5e9 !important;color:#fff !important;font-size:26px !important;line-height:1 !important;box-shadow:0 8px 24px rgba(14,165,233,.45);display:flex !important;align-items:center;justify-content:center;visibility:visible !important;opacity:1 !important}',
      '#bsb-btn:hover{background:#0284c7 !important}',
      '#bsb-panel{display:none;position:absolute;right:0;bottom:68px;width:min(360px,calc(100vw - 24px));height:480px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 48px rgba(15,23,42,.22);flex-direction:column}',
      '#bsb-panel.open{display:flex !important}',
      '#bsb-head{background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;padding:14px 16px;font-weight:600;font-size:15px;display:flex;justify-content:space-between;align-items:center}',
      '#bsb-close{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:0 4px}',
      '#bsb-msgs{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}',
      '.bsb-msg{max-width:88%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}',
      '.bsb-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a}',
      '.bsb-msg.user{align-self:end;background:#0ea5e9;color:#fff}',
      '.bsb-msg.sys{align-self:center;background:transparent;color:#64748b;font-size:12px}',
      '.bsb-map{max-width:100%;border-radius:12px;margin-top:8px;display:block}',
      '#bsb-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}',
      '#bsb-input{flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-size:14px;outline:none}',
      '#bsb-input:focus{border-color:#0ea5e9}',
      '#bsb-send{border:0;border-radius:12px;background:#0ea5e9;color:#fff;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer}',
      '#bsb-send:disabled{opacity:.6;cursor:default}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);

    var root = document.createElement('div');
    root.id = 'bsb-root';
    root.innerHTML = [
      '<div id="bsb-panel" role="dialog" aria-label="Чат">',
      '  <div id="bsb-head"><span id="bsb-title">Boat Sochi</span><button id="bsb-close" type="button" aria-label="Закрыть">×</button></div>',
      '  <div id="bsb-msgs"></div>',
      '  <form id="bsb-form">',
      '    <input id="bsb-input" type="text" placeholder="Ваш вопрос..." autocomplete="off" maxlength="2000" />',
      '    <button id="bsb-send" type="submit">➤</button>',
      '  </form>',
      '</div>',
      '<button id="bsb-btn" type="button" aria-label="Открыть чат">💬</button>',
    ].join('');
    document.body.appendChild(root);

    var panel = root.querySelector('#bsb-panel');
    var btn = root.querySelector('#bsb-btn');
    var closeBtn = root.querySelector('#bsb-close');
    var msgs = root.querySelector('#bsb-msgs');
    var form = root.querySelector('#bsb-form');
    var input = root.querySelector('#bsb-input');
    var sendBtn = root.querySelector('#bsb-send');
    var title = root.querySelector('#bsb-title');

    function addBubble(text, kind) {
      var el = document.createElement('div');
      el.className = 'bsb-msg ' + kind;
      el.textContent = text;
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function setOpen(v) {
      open = v;
      panel.classList.toggle('open', open);
      btn.textContent = open ? '×' : '💬';
      if (open) input.focus();
    }

    btn.addEventListener('click', function () {
      setOpen(!open);
    });
    closeBtn.addEventListener('click', function () {
      setOpen(false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = (input.value || '').trim();
      if (!text || sending) return;
      input.value = '';
      sendMessage(text);
    });

    function sendMessage(text) {
      addBubble(text, 'user');
      messages.push({ role: 'user', content: text });
      sending = true;
      sendBtn.disabled = true;

      fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, sessionId: sessionId }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok && !data.reply) throw new Error(data.error || 'Ошибка');
            return data;
          });
        })
        .then(function (data) {
          var reply =
            data.reply ||
            'Не удалось получить ответ. Босс Олег: +7 917 675 0555, мадам Наталья: +7 918 304-40-00';
          messages.push({ role: 'assistant', content: reply });
          addBubble(reply, 'bot');
          if (data.mapUrl) {
            var img = document.createElement('img');
            img.className = 'bsb-map';
            img.alt = 'Схема прохода к причалу';
            img.src = data.mapUrl.indexOf('http') === 0 ? data.mapUrl : API_BASE + data.mapUrl;
            msgs.appendChild(img);
            msgs.scrollTop = msgs.scrollHeight;
          }
        })
        .catch(function () {
          addBubble(
            'Связь прервалась. Босс Олег: +7 917 675 0555, мадам Наталья: +7 918 304-40-00',
            'sys'
          );
        })
        .finally(function () {
          sending = false;
          sendBtn.disabled = false;
        });
    }

    fetch(API_BASE + '/api/widget-config')
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (cfg) {
        if (cfg) {
          if (cfg.name) botName = cfg.name;
          if (cfg.greeting) greeting = cfg.greeting;
        }
      })
      .catch(function () {})
      .finally(function () {
        title.textContent = botName;
        addBubble(greeting, 'bot');
      });
  }

  onReady(mount);
})();
