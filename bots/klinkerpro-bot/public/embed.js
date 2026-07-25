(function () {
  'use strict';

  // Скрипт часто вставляют в <head> (Tilda). Нельзя трогать body до его появления.
  // Флаг ставим только после успешного монтирования — иначе повторный T123 молчит.
  if (window.__klinkerProBotLoaded) return;

  var scriptEl = document.currentScript;
  var API_BASE = '';
  if (scriptEl && scriptEl.src) {
    try {
      API_BASE = new URL(scriptEl.src).origin;
    } catch (e) {
      API_BASE = '';
    }
  }
  if (!API_BASE) API_BASE = 'https://klinker.webtaxi2.ru';

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
    var SESSION_KEY = 'klinkerpro_bot_session';
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
    return '<a class="kpb-link" href="#bot">' + label + '</a>';
  }

  /** Обработка только текстовых кусков вне HTML-тегов. */
  function mapTextOutsideTags(html, fn) {
    return html.replace(/(^|>)([^<]*)/g, function (_m, prefix, part) {
      return prefix + fn(part);
    });
  }

  var ZAKAZ_URL_RE =
    /(?:https?:\/\/marmara-pro\.ru\/)?#(?:bot|zakaz)\b/gi;

  /** Телефоны, https-ссылки и заявка на обратный звонок → кликабельные. */
  function linkifyText(text) {
    var escaped = escapeHtml(text);
    // явные маркеры {{tel:+79…|подпись}} из приветствий / сервера
    escaped = escaped.replace(/\{\{tel:(\+?\d+)\|([^}]+)\}\}/g, function (_m, tel, label) {
      return '<a class="kpb-tel" href="tel:' + tel + '">' + label + '</a>';
    });
    // фраза (+ опционально URL/#bot рядом) → одна ссылка на #bot
    escaped = escaped.replace(
      /((?:оставить\s+)?заявк[ауеиы]?\s+на\s+обратный\s+звонок)(?:\s+на\s+сайте)?(?:\s*:\s*)?(?:https?:\/\/marmara-pro\.ru\/(?:termo|main)#(?:bot|zakaz)|#(?:bot|zakaz))?/gi,
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
          '<a class="kpb-link" href="' +
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
        return '<a class="kpb-tel" href="tel:+' + digits + '">' + phone + '</a>';
      });
    });
    return escaped;
  }

  function mount() {
    if (window.__klinkerProBotLoaded) return;
    if (!document.body) return;
    window.__klinkerProBotLoaded = true;

    var sessionId = getSessionId();
    var messages = [];
    var open = false;
    var sending = false;
    var botName = 'КлинкерПрофи';
    var greeting =
      'Здравствуйте! Я консультант КлинкерПрофи.\nРасскажу про фасадные термопанели, клинкер и клинкерный кирпich на фасаде.\nЗадайте вопрос — отвечу по делу.';
    var unavailableReply = [
      'Сейчас помощник временно недоступен. Свяжитесь с КлинкерПрофи:',
      '',
      '+7 (921) 745-77-55',
      'https://marmara-pro.ru/termo',
    ].join('\n');

    var ICON_ARROW =
      '<svg class="kpb-ico" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.9 11.1c.5.5.5 1.3 0 1.8l-6.3 6.3-1.5-1.5 4.7-4.7H3.2v-2.1h14.6l-4.7-4.7 1.5-1.5 6.3 6.4z" fill="currentColor"/></svg>';
    var ICON_CLOSE =
      '<svg class="kpb-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
    var BTN_LABEL = '<span class="kpb-btn-label">помощник</span>';
    var LOGO_URL =
      'https://static.tildacdn.com/tild3834-3566-4635-a531-343234633735/LOGO_.svg';
    var INTRO_KEY = 'klinkerpro_bot_intro_v2';
    var introPending = false;
    try {
      introPending = !localStorage.getItem(INTRO_KEY);
    } catch (eIntro) {
      introPending = false;
    }

    var style = document.createElement('style');
    style.textContent = [
      '#kpb-root{all:initial;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;position:fixed !important;inset:0 !important;z-index:2147483000 !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:none !important;color:#0f172a}',
      '#kpb-root *{box-sizing:border-box;font-family:inherit}',
      '#kpb-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;pointer-events:none}',
      '#kpb-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}',
      '#kpb-btn{all:initial;position:fixed !important;right:16px !important;bottom:20px !important;min-width:56px !important;height:48px !important;border:2px solid #5A4538 !important;border-radius:5px !important;cursor:pointer;background:#6B5344 !important;color:#fff !important;line-height:1.05 !important;box-shadow:0 8px 24px rgba(90,69,56,.35);display:flex !important;flex-direction:row !important;align-items:center;justify-content:center;gap:6px;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;z-index:2147483001 !important;padding:8px 14px !important;margin:0 !important;transform:none !important;transition:none !important;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;box-sizing:border-box !important;-webkit-tap-highlight-color:transparent}',
      '#kpb-btn.kpb-hidden,#kpb-btn.kpb-scroll-hidden{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important}',
      '#kpb-btn *{box-sizing:border-box;font-family:inherit;pointer-events:none}',
      '#kpb-btn:hover{background:#5A4538 !important}',
      '#kpb-btn .kpb-btn-label{font-size:15px;font-weight:600;letter-spacing:.02em;line-height:1;white-space:nowrap}',
      '#kpb-panel{position:absolute;top:auto;right:0;bottom:0;height:75vh;max-height:75vh;width:min(600px,100vw);max-width:100vw;background:#fff;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(15,23,42,.2);transform:translateX(105%);transition:transform .28s ease;pointer-events:auto;z-index:3;border-radius:5px 0 0 0;overflow:hidden}',
      '#kpb-panel.open{transform:translateX(0)}',
      '#kpb-head{position:relative;background:#6B5344;color:#fff;min-height:56px;padding:10px 44px 10px 14px;display:flex;align-items:center;justify-content:flex-start;gap:12px;flex-shrink:0;flex-wrap:nowrap}',
      '#kpb-head .kpb-logo{display:block;flex-shrink:0;height:34px;width:auto;max-width:130px;object-fit:contain;object-position:left center}',
      '#kpb-head-label{font-size:17px;font-weight:600;letter-spacing:.02em;color:#fff;white-space:nowrap}',
      '#kpb-title{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '#kpb-close{position:absolute;right:8px;top:8px;background:transparent;border:0;color:#fff;cursor:pointer;line-height:1;padding:4px;display:flex;align-items:center;justify-content:center;z-index:2}',
      '#kpb-msgs{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}',
      '.kpb-msg{max-width:88%;padding:10px 12px;border-radius:5px;font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
      '.kpb-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#2d2d2d}',
      '.kpb-msg.user{align-self:flex-end;background:#8B7355;color:#fff;border-radius:20px}',
      '.kpb-msg.sys{align-self:center;background:transparent;color:#64748b;font-size:13px}',
      '#kpb-root a.kpb-tel,#kpb-root a.kpb-link{color:#6B5344 !important;font-weight:600 !important;text-decoration:underline !important;text-underline-offset:2px;cursor:pointer !important;pointer-events:auto !important}',
      '#kpb-root .kpb-msg.user a.kpb-tel,#kpb-root .kpb-msg.user a.kpb-link{color:#fff !important}',
      '#kpb-root .kpb-msg.sys a.kpb-tel,#kpb-root .kpb-msg.sys a.kpb-link{color:#6B5344 !important}',
      '.kpb-map{max-width:100%;border-radius:5px;margin-top:8px;display:block}',
      '#kpb-form{display:flex;gap:8px;padding:10px;padding-bottom:16px;margin-bottom:30px;border-top:1px solid #e2e8f0;background:#fff;flex-shrink:0}',
      '#kpb-input{flex:1;border:1px solid #cbd5e1;border-radius:5px;padding:10px 12px;font-size:16px;outline:none}',
      '#kpb-input:focus{border-color:#6B5344}',
      '#kpb-send{border:0;border-radius:5px;background:#6B5344;color:#fff;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '#kpb-send:disabled{opacity:.6;cursor:default}',
      '#kpb-send .kpb-ico{width:20px;height:20px}',
      /* та же компоновка шапки, что на десктопе — только компактнее */
      '@media (max-width:1024px){#kpb-panel{width:90vw;max-width:90vw;height:75vh;max-height:75vh;top:auto;bottom:0;border-radius:5px 0 0 0}#kpb-head{min-height:52px;padding:8px 40px 8px 12px}#kpb-head .kpb-logo{height:30px;max-width:110px}#kpb-head-label{font-size:16px}}',
      '@media (max-width:480px){#kpb-panel{height:70vh;max-height:70vh}#kpb-head{min-height:48px;padding:8px 36px 8px 10px}#kpb-head .kpb-logo{height:26px;max-width:96px}#kpb-head-label{font-size:15px}#kpb-close{right:6px;top:6px}#kpb-close .kpb-ico{width:18px;height:18px}}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);

    var root = document.createElement('div');
    root.id = 'kpb-root';
    root.innerHTML = [
      '<div id="kpb-backdrop" aria-hidden="true"></div>',
      '<div id="kpb-panel" role="dialog" aria-label="Чат" aria-hidden="true">',
      '  <div id="kpb-head">',
      '    <img class="kpb-logo" src="' + LOGO_URL + '" alt="КлинкерПрофи" />',
      '    <span class="kpb-head-label">помощник</span>',
      '    <span id="kpb-title">КлинкерПрофи</span>',
      '    <button id="kpb-close" type="button" aria-label="Закрыть">' + ICON_CLOSE + '</button>',
      '  </div>',
      '  <div id="kpb-msgs"></div>',
      '  <form id="kpb-form">',
      '    <input id="kpb-input" type="text" placeholder="Напишите ваш вопрос..." autocomplete="off" maxlength="2000" />',
      '    <button id="kpb-send" type="submit" aria-label="Отправить">' + ICON_ARROW + '</button>',
      '  </form>',
      '</div>',
    ].join('');
    document.body.appendChild(root);

    // Кнопка вне #kpb-root: иначе на мобиле прыгает вместе с inset:0 при скрытии/показе панели браузера
    var btn = document.createElement('button');
    btn.id = 'kpb-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Открыть ИИ-помощника');
    btn.title = 'ИИ-помощник';
    btn.innerHTML = BTN_LABEL;
    if (introPending) {
      btn.classList.add('kpb-hidden');
    } else {
      btn.classList.remove('kpb-scroll-hidden');
    }
    document.body.appendChild(btn);

    var panel = root.querySelector('#kpb-panel');
    var backdrop = root.querySelector('#kpb-backdrop');
    var closeBtn = root.querySelector('#kpb-close');
    var msgs = root.querySelector('#kpb-msgs');
    var form = root.querySelector('#kpb-form');
    var input = root.querySelector('#kpb-input');
    var sendBtn = root.querySelector('#kpb-send');
    var title = root.querySelector('#kpb-title');
    var INTRO_SCROLL_PX = 80;

    function markIntroDone() {
      if (!introPending) return;
      introPending = false;
      try {
        localStorage.setItem(INTRO_KEY, '1');
      } catch (eMark) {
        /* ignore */
      }
      btn.classList.remove('kpb-scroll-hidden');
    }

    function pageScrollY() {
      return (
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    function updateFabScrollVisibility() {
      if (introPending) return;
      btn.classList.remove('kpb-scroll-hidden');
    }

    function onPageScrollIntro() {
      if (introPending && open && pageScrollY() >= INTRO_SCROLL_PX) {
        setOpen(false);
        markIntroDone();
      }
      schedulePinFab();
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
      var desktop = !window.matchMedia('(max-width:1024px)').matches;
      // планшет портрет: влево на ширину кнопки, вверх на её высоту
      // десктоп: вверх на две ширины кнопки
      var right = 16 + (tablet ? w : 0);
      var lift = tablet ? h : desktop ? 2 * w : 0;
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
      onPageScrollIntro();
    }, { passive: true });
    window.addEventListener('resize', schedulePinFab);
    window.addEventListener('orientationchange', schedulePinFab);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedulePinFab);
      window.visualViewport.addEventListener('scroll', schedulePinFab);
    }

    function addBubble(text, kind) {
      var el = document.createElement('div');
      el.className = 'kpb-msg ' + kind;
      el.innerHTML = linkifyText(text);
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function setOpen(v, opts) {
      opts = opts || {};
      open = v;
      panel.classList.toggle('open', open);
      var showBackdrop = open && opts.backdrop !== false;
      backdrop.classList.toggle('open', showBackdrop);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      btn.classList.toggle('kpb-hidden', open);
      btn.setAttribute('aria-hidden', open ? 'true' : 'false');
      var lockScroll = open && opts.lockScroll !== false;
      document.documentElement.style.overflow = lockScroll ? 'hidden' : '';
      if (!open) {
        schedulePinFab();
      }
    }

    btn.addEventListener('click', function () {
      if (open) return;
      setOpen(true, { backdrop: true, lockScroll: true });
    });
    closeBtn.addEventListener('click', function () {
      setOpen(false);
      markIntroDone();
    });
    backdrop.addEventListener('click', function () {
      setOpen(false);
      markIntroDone();
    });

    // Клик по «заявку на обратный звонок» (#bot) — закрыть чат, чтобы заполнить форму на странице
    msgs.addEventListener('click', function (e) {
      var t = e.target;
      var a = t && t.closest ? t.closest('a.kpb-link') : null;
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
            img.className = 'kpb-map';
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
        if (introPending) {
          setOpen(true, { backdrop: false, lockScroll: false });
        }
      });
  }

  onReady(mount);
})();
