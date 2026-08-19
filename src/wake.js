'use strict';

const WAKE_RE =
  /вейк(?:борд)?|wake(?:board)?|водн\w*\s+лыж|водные\s+лыжи|wake\s*board|фал/i;

const FAL_RE = /фал/i;
const WAKEBOARD_RE = /вейк(?:борд)?|wake(?:board)?|wake\s*board/i;
const SKIS_RE = /водн\w*\s+лыж|водные\s+лыжи/i;

function isWakeIntent(text) {
  return WAKE_RE.test(String(text || ''));
}

function buildInfinitiBlock() {
  return [
    'Для вейка и водных лыж у нас — быстроходный катер «Инфинити» (FIBRAFORD 190): до 70 км/ч, до 6 гостей, выход из Имеретинского порта.',
    '8 000 ₽/час за весь катер с катанием на вейкборде или водных лыжах. Капитан — он же инструктор: объяснит технику, подберёт скорость и поможет новичкам встать с воды.',
    'При заказе от 3 часов — скидка, уточняйте у капитана.',
  ].join('\n\n');
}

function buildWakeReply(userText) {
  const text = String(userText || '');
  const parts = [];

  if (FAL_RE.test(text) && !WAKEBOARD_RE.test(text) && !SKIS_RE.test(text)) {
    parts.push(
      'Фал — буксировочный трос с рукояткой для вейкборда и водных лыж: крепится к катеру, почти не растягивается, длина обычно около 20–23 м. В разговоре про эти виды спорта говорят «фал», не «канат».'
    );
  } else if (WAKEBOARD_RE.test(text) && !SKIS_RE.test(text)) {
    parts.push(
      'Вейкборд — катание на доске за катером: держитесь за рукоятку фала, катер тянет вас по кильватерной волне — по ней можно кататься и делать прыжки.'
    );
  } else if (SKIS_RE.test(text) && !WAKEBOARD_RE.test(text)) {
    parts.push(
      'Водные лыжи — классика катания за катером: на двух лыжах держитесь за рукоятку фала, капитан подбирает скорость и траекторию.'
    );
  } else {
    parts.push(
      'Вейкборд — доска за катером, катание по кильватерной волне; водные лыжи — две лыжи за катером, держитесь за рукоятку фала.'
    );
  }

  parts.push(buildInfinitiBlock());
  return parts.join('\n\n');
}

module.exports = {
  isWakeIntent,
  buildWakeReply,
};
