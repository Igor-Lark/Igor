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

  function zakazLink(label) {
    // #bot — якорь на текущей странице (без перехода на другой URL)
    return '<a class="bsb-link" href="#bot">' + label + '</a>';
  }

  /** Обработка только текстовых кусков вне HTML-тегов. */
  function mapTextOutsideTags(html, fn) {
    return html.replace(/(^|>)([^<]*)/g, function (_m, prefix, part) {
      return prefix + fn(part);
    });
  }

  var ZAKAZ_URL_RE =
    /(?:https?:\/\/boat-sochi\.ru\/)?#(?:bot|zakaz)\b/gi;

  /** Телефоны, https-ссылки и заявка на обратный звонок → кликабельные. */
  function linkifyText(text) {
    var escaped = escapeHtml(text);
    // фраза (+ опционально URL/#bot рядом) → одна ссылка на #bot
    escaped = escaped.replace(
      /((?:оставить\s+)?заявк[ауеиы]?\s+на\s+обратный\s+звонок)(?:\s+на\s+сайте)?(?:\s*:\s*)?(?:https?:\/\/boat-sochi\.ru\/#(?:bot|zakaz)|#(?:bot|zakaz))?/gi,
      function (_m, phrase) {
        return zakazLink(phrase);
      }
    );
    // оставшиеся #bot / #zakaz только вне тегов
    escaped = mapTextOutsideTags(escaped, function (part) {
      return part.replace(ZAKAZ_URL_RE, function () {
        return zakazLink('заявку на обратный звонок');
      });
    });
    // прочие https только вне тегов
    escaped = mapTextOutsideTags(escaped, function (part) {
      return part.replace(/(https?:\/\/[^\s<>"']+)/g, function (url) {
        var clean = url.replace(/[),.;]+$/g, '');
        var trail = url.slice(clean.length);
        if (/#(?:bot|zakaz)\b/i.test(clean)) {
          return zakazLink('заявку на обратный звонок') + trail;
        }
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
    });
    // телефоны только вне тегов
    escaped = mapTextOutsideTags(escaped, function (part) {
      return part.replace(/(\+?7|8)[ \t\-()]*(\d[ \t\-()]*){10}/g, function (phone) {
        var digits = phone.replace(/\D/g, '');
        if (digits.length === 11 && digits.charAt(0) === '8') {
          digits = '7' + digits.slice(1);
        }
        if (digits.length !== 11 || digits.charAt(0) !== '7') return phone;
        return '<a class="bsb-tel" href="tel:+' + digits + '">' + phone + '</a>';
      });
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
      'Здравствуйте! Помогу с выбором яхты или катера.\nКапитан Олег часто в море — связь может быть неустойчивой. Наталья: +7 918 304-40-00.\nСпрашивайте у меня — или оставьте заявку на обратный звонок на сайте.';
    var unavailableReply = [
      'Сейчас помощник временно недоступен. Свяжитесь с нами:',
      '',
      'Капитан Олег',
      '+7 917 675 0555',
      'https://wa.me/79176750555',
      'https://t.me/Oleg_700',
      'https://max.ru/u/f9LHodD0cOLfwfVnOTd4z8W-cQP1Wvx427sjPPALmFsnT4at-1pMe4Y5NF4',
      '',
      'Наталья',
      '+7 918 304-40-00',
      'https://wa.me/79183044000',
      'https://t.me/nata_rybiy',
      'https://max.ru/u/f9LHodD0cOI8OH4kIB7PsiV6jWNHRWg_O33iJTe5q_TJs73hHe1YBcSMwKk',
      '',
      'Или оставьте заявку на обратный звонок: https://boat-sochi.ru/#bot',
    ].join('\n');

    var ICON_ARROW =
      '<svg class="bsb-ico" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.9 11.1c.5.5.5 1.3 0 1.8l-6.3 6.3-1.5-1.5 4.7-4.7H3.2v-2.1h14.6l-4.7-4.7 1.5-1.5 6.3 6.4z" fill="currentColor"/></svg>';
    var ICON_CLOSE =
      '<svg class="bsb-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
    var BTN_AI_LABEL =
      '<span class="bsb-ai-label">AI</span><span class="bsb-ai-sub">помощник</span>';
    var AVATAR_URL = API_BASE + '/avatar-oleg.jpg';
    var LOGO_URL = API_BASE + '/logo-stripes.svg';

    var style = document.createElement('style');
    style.textContent = [
      '#bsb-root{all:initial;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;position:fixed !important;inset:0 !important;z-index:2147483000 !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:none !important;color:#0f172a}',
      '#bsb-root *{box-sizing:border-box;font-family:inherit}',
      '#bsb-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;pointer-events:none}',
      '#bsb-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}',
      '#bsb-btn{all:initial;position:fixed !important;right:16px !important;bottom:20px !important;min-width:56px !important;height:56px !important;border:2px solid #EF1F1F !important;border-radius:5px !important;cursor:pointer;background:#204360 !important;color:#fff !important;line-height:1.05 !important;box-shadow:0 8px 24px rgba(32,67,96,.4);display:flex !important;flex-direction:column !important;align-items:center;justify-content:center;gap:2px;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;z-index:2147483001 !important;padding:6px 12px !important;margin:0 !important;transform:none !important;transition:none !important;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;box-sizing:border-box !important;-webkit-tap-highlight-color:transparent}',
      '#bsb-btn.bsb-hidden,#bsb-btn.bsb-scroll-hidden{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important}',
      '#bsb-btn *{box-sizing:border-box;font-family:inherit;pointer-events:none}',
      '#bsb-btn:hover{background:#18344c !important}',
      '#bsb-btn .bsb-ico{display:block;flex-shrink:0}',
      '#bsb-btn .bsb-ai-label{font-size:16px;font-weight:800;letter-spacing:.04em;line-height:1}',
      '#bsb-btn .bsb-ai-sub{font-size:10px;font-weight:600;opacity:.95;letter-spacing:.01em;line-height:1;white-space:nowrap}',
      '#bsb-panel{position:absolute;top:auto;right:0;bottom:0;height:75vh;max-height:75vh;width:min(600px,100vw);max-width:100vw;background:#fff;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(15,23,42,.2);transform:translateX(105%);transition:transform .28s ease;pointer-events:auto;z-index:3;border-radius:5px 0 0 0;overflow:hidden}',
      '#bsb-panel.open{transform:translateX(0)}',
      '#bsb-head{--bsb-avatar:64px;position:relative;background:#204360;color:#fff;min-height:96px;padding:12px 44px 12px 14px;display:flex;align-items:center;justify-content:flex-start;gap:12px;flex-shrink:0;flex-wrap:nowrap}',
      '#bsb-head-left,#bsb-head-right{display:flex;align-items:center;gap:10px;min-width:0;flex-shrink:1}',
      '#bsb-head-right{margin-left:var(--bsb-avatar);padding-right:4px}',
      '#bsb-avatar{width:var(--bsb-avatar);height:var(--bsb-avatar);border-radius:50%;object-fit:cover;object-position:center 20%;display:block;flex-shrink:0;border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.25);background:#18344c}',
      '.bsb-oleg-text,.bsb-helper-text{display:flex;flex-direction:column;justify-content:center;line-height:1.15;gap:2px;white-space:nowrap}',
      '.bsb-oleg-name{font-size:15px;font-weight:700}',
      '.bsb-oleg-role{font-size:13px;font-weight:500;opacity:.92}',
      '#bsb-head .bsb-logo{display:block;flex-shrink:0;width:36px;height:33px}',
      '.bsb-helper-line{font-size:14px;font-weight:700;line-height:1.15}',
      '#bsb-title{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '#bsb-close{position:absolute;right:8px;top:8px;background:transparent;border:0;color:#fff;cursor:pointer;line-height:1;padding:4px;display:flex;align-items:center;justify-content:center;z-index:2}',
      '#bsb-msgs{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}',
      '.bsb-msg{max-width:88%;padding:10px 12px;border-radius:5px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}',
      '.bsb-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a}',
      '.bsb-msg.user{align-self:flex-end;background:#5a7f9c;color:#fff;border-radius:20px}',
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
      /* та же компоновка шапки, что на десктопе — только компактнее */
      '@media (max-width:1024px){#bsb-panel{width:90vw;max-width:90vw;height:75vh;max-height:75vh;top:auto;bottom:0;border-radius:5px 0 0 0}#bsb-head{--bsb-avatar:52px;min-height:80px;padding:10px 40px 10px 12px;gap:8px}#bsb-head-left,#bsb-head-right{gap:8px}.bsb-oleg-name{font-size:14px}.bsb-oleg-role,.bsb-helper-line{font-size:12px}#bsb-head .bsb-logo{width:28px;height:26px}}',
      '@media (max-width:480px){#bsb-panel{height:60vh;max-height:60vh}#bsb-head{--bsb-avatar:44px;min-height:72px;padding:8px 36px 8px 10px;gap:6px}#bsb-head-left,#bsb-head-right{gap:6px}#bsb-avatar{border-width:1.5px}.bsb-oleg-name{font-size:13px}.bsb-oleg-role,.bsb-helper-line{font-size:11px}#bsb-head .bsb-logo{width:24px;height:22px}#bsb-close{right:6px;top:6px}#bsb-close .bsb-ico{width:18px;height:18px}}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);

    var root = document.createElement('div');
    root.id = 'bsb-root';
    root.innerHTML = [
      '<div id="bsb-backdrop" aria-hidden="true"></div>',
      '<div id="bsb-panel" role="dialog" aria-label="Чат" aria-hidden="true">',
      '  <div id="bsb-head">',
      '    <div id="bsb-head-left">',
      '      <img id="bsb-avatar" src="' + AVATAR_URL + '" width="64" height="64" alt="Капитан Олег" />',
      '      <div class="bsb-oleg-text"><span class="bsb-oleg-name">Это Олег</span><span class="bsb-oleg-role">Капитан</span></div>',
      '    </div>',
      '    <div id="bsb-head-right">',
      '      <img class="bsb-logo" src="' + LOGO_URL + '" width="36" height="33" alt="" />',
      '      <div class="bsb-helper-text"><span class="bsb-helper-line">А я его</span><span class="bsb-helper-line">помощник</span></div>',
      '    </div>',
      '    <span id="bsb-title">Boat Sochi</span>',
      '    <button id="bsb-close" type="button" aria-label="Закрыть">' + ICON_CLOSE + '</button>',
      '  </div>',
      '  <div id="bsb-msgs"></div>',
      '  <form id="bsb-form">',
      '    <input id="bsb-input" type="text" placeholder="Ваш вопрос..." autocomplete="off" maxlength="2000" />',
      '    <button id="bsb-send" type="submit" aria-label="Отправить">' + ICON_ARROW + '</button>',
      '  </form>',
      '</div>',
    ].join('');
    document.body.appendChild(root);

    // Кнопка вне #bsb-root: иначе на мобиле прыгает вместе с inset:0 при скрытии/показе панели браузера
    var btn = document.createElement('button');
    btn.id = 'bsb-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Открыть ИИ-помощника');
    btn.title = 'ИИ-помощник';
    btn.innerHTML = BTN_AI_LABEL;
    btn.classList.add('bsb-scroll-hidden');
    document.body.appendChild(btn);

    var panel = root.querySelector('#bsb-panel');
    var backdrop = root.querySelector('#bsb-backdrop');
    var closeBtn = root.querySelector('#bsb-close');
    var msgs = root.querySelector('#bsb-msgs');
    var form = root.querySelector('#bsb-form');
    var input = root.querySelector('#bsb-input');
    var sendBtn = root.querySelector('#bsb-send');
    var title = root.querySelector('#bsb-title');
    var SCROLL_SHOW_PX = 80;

    function pageScrollY() {
      return (
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    function updateFabScrollVisibility() {
      var wasHidden = btn.classList.contains('bsb-scroll-hidden');
      var hide = pageScrollY() < SCROLL_SHOW_PX;
      btn.classList.toggle('bsb-scroll-hidden', hide);
      if (wasHidden && !hide) schedulePinFab();
    }

    function fabBaseBottom() {
      if (window.matchMedia('(max-width:480px)').matches) return 110;
      if (window.matchMedia('(max-width:1024px)').matches) return 100;
      return 20;
    }

    /** Вертикальный планшет: 600–1024px в портрете. */
    function isPortraitTablet() {
      return window.matchMedia(
        '(min-width:600px) and (max-width:1024px) and (orientation:portrait)'
      ).matches;
    }

    /** Держим кнопку у нижнего края visual viewport — без прыжка при скролле на мобиле. */
    function pinFab() {
      var base = fabBaseBottom();
      var vv = window.visualViewport;
      var w = btn.offsetWidth || 56;
      var h = btn.offsetHeight || 56;
      var tablet = isPortraitTablet();
      // планшет портрет: влево на ширину кнопки (½+½), вверх на её высоту
      var right = 16 + (tablet ? w : 0);
      var lift = tablet ? h : 0;
      btn.style.right = right + 'px';
      btn.style.left = 'auto';
      if (!vv) {
        btn.style.top = 'auto';
        btn.style.bottom = base + lift + 'px';
        return;
      }
      var top = vv.offsetTop + vv.height - base - lift - h;
      btn.style.bottom = 'auto';
      btn.style.top = Math.max(0, top) + 'px';
    }

    var pinFabRaf = 0;
    function schedulePinFab() {
      if (pinFabRaf) return;
      pinFabRaf = requestAnimationFrame(function () {
        pinFabRaf = 0;
        pinFab();
      });
    }

    updateFabScrollVisibility();
    pinFab();
    window.addEventListener('scroll', function () {
      updateFabScrollVisibility();
      schedulePinFab();
    }, { passive: true });
    window.addEventListener('resize', schedulePinFab);
    window.addEventListener('orientationchange', schedulePinFab);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedulePinFab);
      window.visualViewport.addEventListener('scroll', schedulePinFab);
    }

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
      // display:flex !important в CSS бьёт inline style — прячем классом
      btn.classList.toggle('bsb-hidden', open);
      btn.setAttribute('aria-hidden', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (!open) schedulePinFab();
    }

    btn.addEventListener('click', function () {
      if (open) return;
      setOpen(true);
    });
    closeBtn.addEventListener('click', function () {
      setOpen(false);
    });
    backdrop.addEventListener('click', function () {
      setOpen(false);
    });

    // Клик по «заявку на обратный звонок» (#bot) — закрыть чат, чтобы заполнить форму на странице
    msgs.addEventListener('click', function (e) {
      var t = e.target;
      var a = t && t.closest ? t.closest('a.bsb-link') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href !== '#bot' && href !== '#zakaz' && !/#(?:bot|zakaz)$/i.test(href)) return;
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
          var reply = data.reply || unavailableReply;
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
          addBubble(unavailableReply, 'bot');
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
          if (cfg.unavailableReply) unavailableReply = cfg.unavailableReply;
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
