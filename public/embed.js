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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Телефоны и https-ссылки (WhatsApp / Telegram / MAX) → кликабельные. */
  function linkifyText(text) {
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/(https?:\/\/[^\s<>"']+)/g, function (url) {
      var clean = url.replace(/[),.;]+$/g, '');
      var trail = url.slice(clean.length);
      var label = clean;
      if (/wa\.me\//i.test(clean)) label = 'WhatsApp';
      else if (/t\.me\//i.test(clean)) label = 'Telegram';
      else if (/max\.ru\//i.test(clean)) label = 'MAX';
      return (
        '<a class="bsb-link" href="' +
        clean +
        '" target="_blank" rel="noopener noreferrer">' +
        label +
        '</a>' +
        trail
      );
    });
    // телефоны только в тексте вне тегов (не внутри href)
    escaped = escaped.replace(/(^|>)([^<]*)/g, function (_m, prefix, part) {
      return (
        prefix +
        part.replace(/(\+?7|8)[ \t\-()]*(\d[ \t\-()]*){10}/g, function (phone) {
          var digits = phone.replace(/\D/g, '');
          if (digits.length === 11 && digits.charAt(0) === '8') {
            digits = '7' + digits.slice(1);
          }
          if (digits.length !== 11 || digits.charAt(0) !== '7') return phone;
          return '<a class="bsb-tel" href="tel:+' + digits + '">' + phone + '</a>';
        })
      );
    });
    return escaped;
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
      'Здравствуйте! Помогу выбрать катер или яхту.\nБосс Олег часто в море — связь может быть слабой. Мадам Наталья: +7 918 304-40-00. Спрашивайте у меня — или оставите контакт, свяжемся )';

    var ICON_ARROW =
      '<svg class="bsb-ico" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.9 11.1c.5.5.5 1.3 0 1.8l-6.3 6.3-1.5-1.5 4.7-4.7H3.2v-2.1h14.6l-4.7-4.7 1.5-1.5 6.3 6.4z" fill="currentColor"/></svg>';
    var ICON_CLOSE =
      '<svg class="bsb-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
    var LOGO_STRIPES =
      '<img class="bsb-logo" src="' +
      API_BASE +
      '/logo-stripes.svg" width="28" height="26" alt="" />';

    var style = document.createElement('style');
    style.textContent = [
      '#bsb-root{all:initial;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;position:fixed !important;inset:0 !important;z-index:2147483000 !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:none !important;color:#0f172a}',
      '#bsb-root *{box-sizing:border-box;font-family:inherit}',
      '#bsb-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.4);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;pointer-events:none}',
      '#bsb-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}',
      '#bsb-btn{position:absolute !important;right:20px !important;bottom:20px !important;width:56px !important;height:56px !important;border:0 !important;border-radius:5px !important;cursor:pointer;background:#204360 !important;color:#fff !important;line-height:1 !important;box-shadow:0 8px 24px rgba(32,67,96,.4);display:flex !important;align-items:center;justify-content:center;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;z-index:2;padding:0 !important}',
      '#bsb-btn:hover{background:#18344c !important}',
      '#bsb-btn .bsb-ico{display:block;flex-shrink:0}',
      '#bsb-panel{position:absolute;top:auto;right:0;bottom:0;height:75vh;max-height:75vh;width:min(600px,100vw);max-width:100vw;background:#fff;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(15,23,42,.2);transform:translateX(105%);transition:transform .28s ease;pointer-events:auto;z-index:3;border-radius:5px 0 0 0;overflow:hidden}',
      '#bsb-panel.open{transform:translateX(0)}',
      '#bsb-head{background:#204360;color:#fff;padding:12px 14px;font-weight:600;font-size:15px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:10px}',
      '#bsb-head-left{display:flex;align-items:center;gap:10px;min-width:0}',
      '#bsb-head .bsb-logo{display:block;flex-shrink:0;width:28px;height:26px}',
      '#bsb-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#bsb-close{background:transparent;border:0;color:#fff;cursor:pointer;line-height:1;padding:4px;display:flex;align-items:center;justify-content:center}',
      '#bsb-msgs{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}',
      '.bsb-msg{max-width:88%;padding:10px 12px;border-radius:5px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}',
      '.bsb-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a}',
      '.bsb-msg.user{align-self:flex-end;background:#5a7f9c;color:#fff}',
      '.bsb-msg.sys{align-self:center;background:transparent;color:#64748b;font-size:12px}',
      '.bsb-tel,.bsb-link{color:#204360;font-weight:600;text-decoration:underline;text-underline-offset:2px}',
      '.bsb-msg.user .bsb-tel,.bsb-msg.user .bsb-link{color:#fff}',
      '.bsb-msg.sys .bsb-tel,.bsb-msg.sys .bsb-link{color:#204360}',
      '.bsb-map{max-width:100%;border-radius:5px;margin-top:8px;display:block}',
      '#bsb-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff;flex-shrink:0}',
      '#bsb-input{flex:1;border:1px solid #cbd5e1;border-radius:5px;padding:10px 12px;font-size:14px;outline:none}',
      '#bsb-input:focus{border-color:#204360}',
      '#bsb-send{border:0;border-radius:5px;background:#204360;color:#fff;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '#bsb-send:disabled{opacity:.6;cursor:default}',
      '#bsb-send .bsb-ico{width:20px;height:20px}',
      /* телефон + планшет: панель 90% ширины, кнопка выше виджета «позвонить» */
      '@media (max-width:1024px){#bsb-panel{width:90vw;max-width:90vw;height:75vh;max-height:75vh;top:auto;bottom:0;border-radius:5px 0 0 0}#bsb-btn{bottom:100px !important;right:16px !important}}',
      '@media (max-width:480px){#bsb-panel{height:60vh;max-height:60vh}#bsb-btn{bottom:110px !important}}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);

    var root = document.createElement('div');
    root.id = 'bsb-root';
    root.innerHTML = [
      '<div id="bsb-backdrop" aria-hidden="true"></div>',
      '<div id="bsb-panel" role="dialog" aria-label="Чат" aria-hidden="true">',
      '  <div id="bsb-head">',
      '    <div id="bsb-head-left">' + LOGO_STRIPES + '<span id="bsb-title">Boat Sochi</span></div>',
      '    <button id="bsb-close" type="button" aria-label="Закрыть">' + ICON_CLOSE + '</button>',
      '  </div>',
      '  <div id="bsb-msgs"></div>',
      '  <form id="bsb-form">',
      '    <input id="bsb-input" type="text" placeholder="Ваш вопрос..." autocomplete="off" maxlength="2000" />',
      '    <button id="bsb-send" type="submit" aria-label="Отправить">' + ICON_ARROW + '</button>',
      '  </form>',
      '</div>',
      '<button id="bsb-btn" type="button" aria-label="Открыть чат">' + ICON_ARROW + '</button>',
    ].join('');
    document.body.appendChild(root);

    var panel = root.querySelector('#bsb-panel');
    var backdrop = root.querySelector('#bsb-backdrop');
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
      el.innerHTML = linkifyText(text);
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function setOpen(v) {
      open = v;
      panel.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      btn.innerHTML = open ? ICON_CLOSE : ICON_ARROW;
      btn.setAttribute('aria-label', open ? 'Закрыть чат' : 'Открыть чат');
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open) input.focus();
    }

    btn.addEventListener('click', function () {
      setOpen(!open);
    });
    closeBtn.addEventListener('click', function () {
      setOpen(false);
    });
    backdrop.addEventListener('click', function () {
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
