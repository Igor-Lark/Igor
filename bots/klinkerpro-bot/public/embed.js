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

  var INTRO_SEEN_KEY = 'klinkerpro_intro_seen';

  function hasSeenIntro() {
    try {
      return localStorage.getItem(INTRO_SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  /** При полной перезагрузке (Ctrl+F5 / F5) снова показываем приветствие. */
  function shouldAutoIntro() {
    try {
      var nav =
        performance.getEntriesByType &&
        performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload') {
        localStorage.removeItem(INTRO_SEEN_KEY);
        return true;
      }
    } catch (e) {
      /* ignore */
    }
    return !hasSeenIntro();
  }

  function markIntroSeen() {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch (e) {
      /* ignore */
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

  /** Исправляет лatinицу p/e в слове «кирpich» в тексте чата. */
  function normalizeCyrillicBrick(text) {
    return String(text)
      .replace(/\u043a\u0438\u0440p(?=\u0438\u0447)/gi, '\u043a\u0438\u0440\u043f')
      .replace(/\u043a\u0438\u0440\u043f\u0438\u0447e(?=[\s.,!?;:)\]»"—-]|$)/gi, '\u043a\u0438\u0440\u043f\u0438\u0447\u0435')
      .replace(/\u043a\u0438\u0440\u043f\u0438\u0447\u0065/gi, '\u043a\u0438\u0440\u043f\u0438\u0447\u0435');
  }

  /** Телефоны, https-ссылки и заявка на обратный звонок → кликабельные. */
  function linkifyText(text) {
    var escaped = escapeHtml(normalizeCyrillicBrick(text));
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
      'Здравствуйте! Я помощник КлинкерПрофи.\n' +
      'Расскажу про фасадные термопанели, клинкер и клинкерный кирпич на фасаде — как у нас в Выборге изготавливается термопанель и на что обратить внимание в Ленобласти.\n' +
      'Могу провести расчёт: площадь фасада, количество термопанелей, клей и затирку.\n' +
      'Задайте вопрос или напишите размеры дома.';
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
    var ICON_HOME =
      '<svg class="kpb-btn-home" width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M3 10.5L12 3.5 21 10.5M5 10.5V20h14V10.5" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="9.2" y="13.1" width="2.35" height="2.35" fill="#fff"/>' +
      '<rect x="12.45" y="13.1" width="2.35" height="2.35" fill="#fff"/>' +
      '<rect x="9.2" y="16.35" width="2.35" height="2.35" fill="#fff"/>' +
      '<rect x="12.45" y="16.35" width="2.35" height="2.35" fill="#fff"/>' +
      '</svg>';
    var ASSIST_LABEL_COPY =
      '<span class="kpb-btn-copy"><span class="kpb-btn-line1">AI помощник</span><span class="kpb-btn-line2">знаю ответы, сделаю расчёт</span></span>';
    var BTN_LABEL =
      '<span class="kpb-btn-icon">' + ICON_HOME + '</span>' + ASSIST_LABEL_COPY;
    var HEAD_ASSIST_LABEL =
      '<div class="kpb-head-assist" aria-hidden="false">' +
      '<span class="kpb-btn-icon">' +
      ICON_HOME +
      '</span>' +
      ASSIST_LABEL_COPY +
      '</div>';
    var LOGO_URL =
      'https://static.tildacdn.com/tild6661-3037-4234-b636-643434333430/Group_6302_1.svg';
    var LOGO_SQUARE_URL =
      (API_BASE || 'https://klinker.webtaxi2.ru') + '/klinkerpro-logo-square.png';
    var introStartScrollY = 0;
    var INTRO_SCROLL_PX = 50;
    var MOBILE_FAB_SCROLL_PX = 80;
    var INTRO_OPEN_DELAY_MS = 1000;
    var PANEL_SLIDE_MS = 1000;
    var collapsing = false;
    var COLLAPSE_MS = 450;
    var compactClearTimer = 0;
    var deskModalClearTimer = 0;
    /** Кнопка виджета: 220×60 px, right 60 / bottom 100 (см. pinFab) */
    var FAB_WIDTH_PX = 220;
    var FAB_HEIGHT_PX = 60;
    var FAB_RIGHT_PX = 60;
    var FAB_BOTTOM_PX = 100;
    var MOBILE_FAB_BOTTOM_PX = 50;
    var DESKTOP_MQ = '(min-width:1025px)';
    var MOBILE_MQ = '(max-width:1024px)';

    function isDesktopUi() {
      return window.matchMedia(DESKTOP_MQ).matches;
    }

    function isMobileUi() {
      return window.matchMedia(MOBILE_MQ).matches;
    }

    var autoIntroActive = shouldAutoIntro() && !isMobileUi();

    function endAutoIntro() {
      autoIntroActive = false;
      markIntroSeen();
      btn.classList.remove('kpb-scroll-hidden');
    }

    var style = document.createElement('style');
    style.textContent = [
      '#kpb-root{all:initial;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;position:fixed !important;inset:0 !important;z-index:2147483000 !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:none !important;color:#0f172a}',
      '#kpb-root *{box-sizing:border-box;font-family:inherit}',
      '#kpb-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.594);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;pointer-events:none}',
      '#kpb-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}',
      '#kpb-btn{all:initial;position:fixed !important;left:auto !important;right:60px !important;bottom:100px !important;width:220px !important;min-width:220px !important;max-width:220px !important;height:60px !important;border:1px solid rgba(255,255,255,.8) !important;border-radius:10px !important;cursor:pointer;background:rgba(213,77,0,.8) !important;color:#fff !important;line-height:1.1 !important;box-shadow:0 8px 24px rgba(213,77,0,.35);display:flex !important;flex-direction:row !important;align-items:center;justify-content:flex-start;gap:8px;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;z-index:2147483001 !important;padding:0 12px 0 14px !important;margin:0 !important;transform:none !important;transition:none !important;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif !important;box-sizing:border-box !important;-webkit-tap-highlight-color:transparent}',
      '#kpb-btn.kpb-hidden,#kpb-btn.kpb-scroll-hidden{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important}',
      '#kpb-btn.kpb-pre-show{display:flex !important;visibility:visible !important;opacity:0 !important;pointer-events:none !important}',
      '#kpb-btn.kpb-attention{animation:kpbFabPulse .55s ease-in-out 3 !important}',
      '@keyframes kpbFabPulse{0%,100%{box-shadow:0 8px 24px rgba(213,77,0,.35)}50%{box-shadow:0 0 0 4px rgba(255,255,255,.95),0 12px 36px rgba(213,77,0,.55)}}',
      '#kpb-panel.kpb-collapsing{pointer-events:none;overflow:hidden}',
      '#kpb-panel.kpb-collapsing #kpb-msgs,#kpb-panel.kpb-collapsing #kpb-form{opacity:0;transition:opacity .15s ease}',
      '#kpb-btn *{box-sizing:border-box;font-family:inherit;pointer-events:none}',
      '#kpb-btn:hover{background:rgba(192,69,0,.8) !important}',
      '#kpb-btn .kpb-btn-icon,#kpb-head .kpb-btn-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:34px;height:34px}',
      '#kpb-btn .kpb-btn-home,#kpb-head .kpb-btn-home{display:block;width:34px;height:34px}',
      '#kpb-btn .kpb-btn-copy,#kpb-head .kpb-btn-copy{display:flex;flex-direction:column;align-items:stretch;justify-content:center;flex:1;min-width:0;text-align:left}',
      '#kpb-btn .kpb-btn-copy{text-align:center}',
      '#kpb-btn .kpb-btn-line1,#kpb-head .kpb-btn-line1{display:block;font-size:16px;font-weight:700;letter-spacing:.01em;line-height:1.12;white-space:nowrap;color:#fff}',
      '#kpb-btn .kpb-btn-line2,#kpb-head .kpb-btn-line2{display:block;font-size:11.5px;font-weight:500;letter-spacing:-.02em;line-height:1.18;white-space:nowrap;opacity:.96;margin-top:2px;color:#fff}',
      '#kpb-panel{position:absolute;top:auto;right:0;bottom:0;height:75vh;max-height:75vh;width:min(600px,100vw);max-width:100vw;background:#fff;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(15,23,42,.2);transform:translateX(105%);transition:transform ' +
        PANEL_SLIDE_MS / 1000 +
        's ease;pointer-events:auto;z-index:3;border-radius:5px 0 0 0;overflow:hidden}',
      '#kpb-panel.open{transform:translateX(0)}',
      '#kpb-panel.kpb-compact{height:37.5vh;max-height:37.5vh;transition:transform ' +
        PANEL_SLIDE_MS / 1000 +
        's ease,height 0s linear ' +
        PANEL_SLIDE_MS / 1000 +
        's}',
      '#kpb-panel.kpb-compact.kpb-intro{width:min(360px,60vw) !important;max-width:60vw !important;height:52.5vh;max-height:52.5vh;bottom:80px;top:auto}',
      '#kpb-head{position:relative;background:#404040;color:#fff;height:60px;min-height:60px;max-height:60px;padding:0 44px 0 14px;display:flex;align-items:center;justify-content:flex-start;gap:18px;flex-shrink:0;flex-wrap:nowrap}',
      '#kpb-head .kpb-logo{display:block;flex-shrink:0;height:36px;width:auto;max-width:130px;object-fit:contain;object-position:left center}',
      '#kpb-head .kpb-logo-square{display:none;height:36px;width:36px;max-width:36px;object-fit:contain}',
      '#kpb-panel.kpb-intro #kpb-head .kpb-logo-wide{display:none}',
      '#kpb-panel.kpb-intro #kpb-head .kpb-logo-square{display:block}',
      '#kpb-head .kpb-head-assist{display:flex;align-items:center;gap:18px;margin-left:50px;min-width:0;flex:1}',
      '#kpb-panel.kpb-intro #kpb-head .kpb-head-assist{margin-left:20px}',
      '#kpb-title{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
      '#kpb-close{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:0;color:#fff;cursor:pointer;line-height:1;padding:4px;display:flex;align-items:center;justify-content:center;z-index:2}',
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
      '#kpb-send{border:0;border-radius:5px;background:#d54d00;color:#fff;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '#kpb-send:hover{background:#c04500}',
      '#kpb-send:disabled{opacity:.6;cursor:default}',
      '#kpb-send .kpb-ico{width:20px;height:20px}',
      '#kpb-panel.kpb-intro #kpb-send{flex:0 0 auto;min-width:48px !important;max-width:48px;padding:0 7px !important}',
      '@media (min-width:1025px){#kpb-panel.kpb-desk-modal{position:fixed;left:20vw;top:20vh;right:auto;bottom:auto;width:60vw;height:60vh;max-width:60vw;max-height:60vh;border-radius:5px;box-shadow:0 24px 60px rgba(15,23,42,.25);transform:translateX(100vw)}#kpb-panel.kpb-desk-modal.open{transform:translateX(0)}#kpb-send{min-width:96px;padding:0 28px;flex-shrink:0}#kpb-panel.kpb-intro #kpb-send{min-width:48px !important;max-width:48px;padding:0 7px !important}}',
      /* планшет/мобила — без изменений в этом релизе */
      '@media (max-width:1024px){#kpb-panel{width:90vw;max-width:90vw;height:86.25vh;max-height:86.25vh;top:auto;bottom:0;border-radius:5px 0 0 0}#kpb-panel.kpb-compact{height:43.125vh;max-height:43.125vh}#kpb-panel.kpb-compact.kpb-intro{width:54vw !important;max-width:54vw !important;height:60.375vh;max-height:60.375vh;bottom:80px}#kpb-head{height:60px;min-height:60px;max-height:60px;padding:0 40px 0 12px;gap:18px}#kpb-head .kpb-logo-wide{display:none}#kpb-head .kpb-logo-square{display:block;height:32px;width:32px;max-width:32px}#kpb-head .kpb-head-assist{margin-left:15px;gap:18px}#kpb-panel.kpb-intro #kpb-head .kpb-head-assist{margin-left:15px}#kpb-head .kpb-btn-line1{font-size:15px}#kpb-head .kpb-btn-line2{font-size:10.5px}#kpb-close .kpb-ico{width:22px;height:22px}#kpb-btn{left:20px !important;right:auto !important;bottom:50px !important;width:220px !important;min-width:220px !important;max-width:220px !important;justify-content:flex-start !important;background:rgba(213,77,0,.8) !important;border:1px solid rgba(255,255,255,.8) !important}#kpb-btn:hover{background:rgba(192,69,0,.8) !important}}',
      '@media (max-width:480px){#kpb-panel{height:80.5vh;max-height:80.5vh}#kpb-panel.kpb-compact{height:40.25vh;max-height:40.25vh}#kpb-panel.kpb-compact.kpb-intro{width:54vw !important;max-width:54vw !important;height:56.35vh;max-height:56.35vh;bottom:80px}#kpb-head{height:60px;min-height:60px;max-height:60px;padding:0 36px 0 10px;gap:18px}#kpb-head .kpb-logo-square{height:28px;width:28px;max-width:28px}#kpb-head .kpb-head-assist{margin-left:15px;gap:18px}#kpb-panel.kpb-intro #kpb-head .kpb-head-assist{margin-left:15px}#kpb-head .kpb-btn-icon,#kpb-head .kpb-btn-home{width:30px;height:30px}#kpb-head .kpb-btn-line1{font-size:14px}#kpb-head .kpb-btn-line2{font-size:10px}#kpb-close{right:6px}#kpb-close .kpb-ico{width:22px;height:22px}#kpb-btn .kpb-btn-line2{font-size:10.5px}#kpb-btn{bottom:50px !important}}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);

    var root = document.createElement('div');
    root.id = 'kpb-root';
    root.innerHTML = [
      '<div id="kpb-backdrop" aria-hidden="true"></div>',
      '<div id="kpb-panel" role="dialog" aria-label="Чат" aria-hidden="true">',
      '  <div id="kpb-head">',
      '    <img class="kpb-logo kpb-logo-wide" src="' + LOGO_URL + '" alt="КлинкерПрофи" />',
      '    <img class="kpb-logo kpb-logo-square" src="' + LOGO_SQUARE_URL + '" alt="" />',
      HEAD_ASSIST_LABEL,
      '    <span id="kpb-title">КлинкерПрофи · AI помощник</span>',
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
    if (autoIntroActive) {
      btn.classList.add('kpb-hidden');
    } else if (isMobileUi() && pageScrollY() < MOBILE_FAB_SCROLL_PX) {
      btn.classList.add('kpb-scroll-hidden');
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

    function pageScrollY() {
      return (
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    function updateFabScrollVisibility() {
      if (open) {
        btn.classList.remove('kpb-scroll-hidden');
        return;
      }
      if (autoIntroActive) return;
      if (isMobileUi() && pageScrollY() < MOBILE_FAB_SCROLL_PX) {
        btn.classList.add('kpb-scroll-hidden');
      } else {
        btn.classList.remove('kpb-scroll-hidden');
      }
    }

    function onPageScrollIntro() {
      if (
        autoIntroActive &&
        open &&
        Math.abs(pageScrollY() - introStartScrollY) >= INTRO_SCROLL_PX
      ) {
        endAutoIntro();
        setOpen(false, { collapseToFab: false, keepCompactUntilClosed: true });
      }
      schedulePinFab();
    }

    /** right 60 / bottom 100; мобила — 220px, left 20px, после прокрутки 80px. */
    function pinFab() {
      var vv = window.visualViewport;
      var h = btn.offsetHeight || FAB_HEIGHT_PX;
      var mobile = isMobileUi();
      if (mobile) {
        var side = 20;
        var bottom = MOBILE_FAB_BOTTOM_PX;
        var w = FAB_WIDTH_PX;
        btn.style.minWidth = w + 'px';
        btn.style.maxWidth = w + 'px';
        if (!vv) {
          btn.style.left = side + 'px';
          btn.style.right = 'auto';
          btn.style.width = w + 'px';
          btn.style.top = 'auto';
          btn.style.bottom = bottom + 'px';
          return;
        }
        btn.style.left = vv.offsetLeft + side + 'px';
        btn.style.width = w + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        var top = vv.offsetTop + vv.height - bottom - h;
        btn.style.top = Math.max(vv.offsetTop, top) + 'px';
        return;
      }
      var w = btn.offsetWidth || FAB_WIDTH_PX;
      btn.style.width = w + 'px';
      btn.style.minWidth = '';
      btn.style.maxWidth = '';
      if (!vv) {
        btn.style.left = 'auto';
        btn.style.right = FAB_RIGHT_PX + 'px';
        btn.style.top = 'auto';
        btn.style.bottom = FAB_BOTTOM_PX + 'px';
        return;
      }
      btn.style.right = 'auto';
      btn.style.left =
        vv.offsetLeft + vv.width - FAB_RIGHT_PX - w + 'px';
      btn.style.bottom = 'auto';
      var top = vv.offsetTop + vv.height - FAB_BOTTOM_PX - h;
      btn.style.top = Math.max(vv.offsetTop, top) + 'px';
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
    window.addEventListener('resize', function () {
      schedulePinFab();
      updateFabScrollVisibility();
    });
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

    function resetPanelInlineStyles() {
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
      panel.style.right = '';
      panel.style.bottom = '';
      panel.style.width = '';
      panel.style.height = '';
      panel.style.maxHeight = '';
      panel.style.transition = '';
      panel.style.opacity = '';
      panel.style.borderRadius = '';
      panel.style.zIndex = '';
      panel.style.overflow = '';
    }

    function pulseFabAttention() {
      btn.classList.remove('kpb-pre-show', 'kpb-hidden');
      btn.classList.add('kpb-attention');
      btn.setAttribute('aria-hidden', 'false');
      setTimeout(function () {
        btn.classList.remove('kpb-attention');
      }, 1800);
    }

    /** Панель визуально «съезжает» в кнопку — клиент видит, куда нажать. */
    function collapsePanelToFab() {
      if (collapsing) return;
      collapsing = true;
      open = false;
      backdrop.classList.remove('open');
      document.documentElement.style.overflow = '';
      panel.classList.remove('open');
      panel.classList.add('kpb-collapsing');
      panel.setAttribute('aria-hidden', 'true');

      pinFab();
      var fab = btn.getBoundingClientRect();
      var pr = panel.getBoundingClientRect();
      var trans =
        'top ' +
        COLLAPSE_MS +
        'ms cubic-bezier(0.4,0,0.2,1),left ' +
        COLLAPSE_MS +
        'ms cubic-bezier(0.4,0,0.2,1),width ' +
        COLLAPSE_MS +
        'ms cubic-bezier(0.4,0,0.2,1),height ' +
        COLLAPSE_MS +
        'ms cubic-bezier(0.4,0,0.2,1),opacity ' +
        Math.round(COLLAPSE_MS * 0.55) +
        'ms ease,border-radius ' +
        COLLAPSE_MS +
        'ms ease';

      panel.style.position = 'fixed';
      panel.style.top = pr.top + 'px';
      panel.style.left = pr.left + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.width = pr.width + 'px';
      panel.style.height = pr.height + 'px';
      panel.style.maxHeight = 'none';
      panel.style.transition = trans;
      panel.style.zIndex = '2147483002';
      panel.style.overflow = 'hidden';
      panel.style.opacity = '1';

      btn.classList.remove('kpb-hidden', 'kpb-scroll-hidden');
      btn.classList.add('kpb-pre-show');

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          panel.style.top = fab.top + 'px';
          panel.style.left = fab.left + 'px';
          panel.style.width = fab.width + 'px';
          panel.style.height = fab.height + 'px';
          panel.style.borderRadius = '5px';
          panel.style.opacity = '0';
        });
      });

      setTimeout(function () {
        panel.classList.remove('kpb-collapsing', 'kpb-compact', 'kpb-intro');
        resetPanelInlineStyles();
        collapsing = false;
        pulseFabAttention();
        schedulePinFab();
      }, COLLAPSE_MS + 50);
    }

    function shouldCollapseToFab(opts) {
      return opts.collapseToFab === true;
    }

    function setOpen(v, opts) {
      opts = opts || {};
      if (!v && open && shouldCollapseToFab(opts)) {
        collapsePanelToFab();
        return;
      }
      if (v) {
        collapsing = false;
        if (compactClearTimer) {
          clearTimeout(compactClearTimer);
          compactClearTimer = 0;
        }
        if (deskModalClearTimer) {
          clearTimeout(deskModalClearTimer);
          deskModalClearTimer = 0;
        }
        resetPanelInlineStyles();
        panel.classList.remove('kpb-collapsing');
        btn.classList.remove('kpb-pre-show', 'kpb-attention');
      }
      var wasOpen = open;
      open = v;
      panel.classList.toggle('open', open);
      if (open) {
        panel.classList.toggle('kpb-compact', opts.compact === true);
        panel.classList.toggle('kpb-intro', opts.intro === true);
        panel.classList.toggle(
          'kpb-desk-modal',
          isDesktopUi() && opts.compact !== true
        );
      } else if (wasOpen && (opts.keepCompactUntilClosed || panel.classList.contains('kpb-compact'))) {
        if (compactClearTimer) clearTimeout(compactClearTimer);
        compactClearTimer = setTimeout(function () {
          compactClearTimer = 0;
          if (!open) {
            panel.classList.remove('kpb-compact', 'kpb-intro');
          }
        }, PANEL_SLIDE_MS + 40);
      } else if (!open) {
        panel.classList.remove('kpb-compact', 'kpb-intro');
      }
      if (!open && wasOpen && panel.classList.contains('kpb-desk-modal')) {
        if (deskModalClearTimer) clearTimeout(deskModalClearTimer);
        deskModalClearTimer = setTimeout(function () {
          deskModalClearTimer = 0;
          if (!open) panel.classList.remove('kpb-desk-modal');
        }, PANEL_SLIDE_MS + 40);
      } else if (!open && !wasOpen) {
        panel.classList.remove('kpb-desk-modal');
      }
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
      setOpen(true, { backdrop: true, lockScroll: true, compact: false });
    });
    closeBtn.addEventListener('click', function () {
      setOpen(false, { collapseToFab: false, keepCompactUntilClosed: true });
      endAutoIntro();
    });
    backdrop.addEventListener('click', function () {
      setOpen(false);
      endAutoIntro();
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
        if (autoIntroActive) {
          setTimeout(function () {
            if (!autoIntroActive) return;
            introStartScrollY = pageScrollY();
            setOpen(true, {
              backdrop: false,
              lockScroll: false,
              compact: true,
              intro: true,
            });
          }, INTRO_OPEN_DELAY_MS);
        }
      });
  }

  onReady(mount);
})();