/**
 * config.js — Application state & constants
 *
 * ST is the single source of truth for the fence configurator.
 * All UI controls read from and write to this object,
 * then call buildFence() to re-render.
 */

// Current app mode: 'hero' (landing) | 'config' (configurator open)
let appMode = 'hero';

// ─── FENCE STYLE PARAMS ───────────────────────────────────────
// Кожен стиль — окремий об'єкт з параметрами профілів.
// buildFence() обирає потрібний за ST.fenceStyle.
// Щоб додати новий стиль: скопіюй блок і зміни значення.
const FENCE_STYLES = {

  // ── №1: Сквер Пайп мод. B ─────────────────────────────────
  // Прути 20×20мм, рейки 40×20мм, стовп 60×80мм
  1: {
    barW:       0.022,  // ширина прута (мм, напрям X)
    barD:       0.022,  // глибина прута (мм, напрям Z)
    barGap:     0.107,  // крок між прутами центр-до-центру
    railH:      0.020,  // висота рейки
    railD:      0.040,  // глибина рейки
    railBot:    0.120,  // відстань нижньої рейки від землі
    railTopOff: 0.025,  // відступ верхньої рейки від верху стовпа
    postW:      0.060,  // ширина стовпа (X)
    postD:      0.080,  // глибина стовпа (Z)
    postExtra:  0.000,  // на скільки стовп вище за секцію
    capW:       0.072,
    capD:       0.094,
    capH:       0.018,
  },

  // ── №2: Списи (lance) ─────────────────────────────────────
  2: {
    barW:       0.020,
    barD:       0.040,
    barGap:     0.110,
    railH:      0.060,
    railBotH:   0.060,
    railD:      0.040,
    railBot:    0.400,
    railTopOff: 0.270,
    postW:      0.080,
    postD:      0.060,
    postExtra:  0.000,
    capW:       0.096,
    capD:       0.076,
    capH:       0.018,
    barTopExt:  0.250,
    barBotExt:  0.250,
    barOnRail:  true,
    railMid:    false,
  },

  // ── №3: Списи мод. B ──────────────────────────────────────
  3: {
    barW:       0.020,
    barD:       0.040,
    barGap:     0.110,
    railH:      0.060,
    railBotH:   0.060,
    railD:      0.040,
    railBot:    0.400,
    railTopOff: 0.270,
    postW:      0.080,
    postD:      0.060,
    postExtra:  0.000,
    capW:       0.096,
    capD:       0.076,
    capH:       0.018,
    barTopExt:  0.250,
    barBotExt:  0.250,
    barOnRail:  true,
    railMid:    false,
    barTipH:    0.040,  // зріз верху прута: 0 = рівно, >0 = діагональний зріз (м)
  },

  // ── №4: Списи мод. C — налаштовувана гострота ────────────────
  4: {
    barW:       0.020,
    barD:       0.040,
    barGap:     0.110,
    railH:      0.060,
    railBotH:   0.060,
    railD:      0.040,
    railBot:    0.400,
    railTopOff: 0.270,
    postW:      0.080,
    postD:      0.060,
    postExtra:  0.000,
    capW:       0.096,
    capD:       0.076,
    capH:       0.018,
    barTopExt:  0.250,
    barBotExt:  0.250,
    barOnRail:  true,
    railMid:    false,
    barTipH:    0.060,
  },

  // ── №5: Сквер Пайп мод. D — горизонтальні прути ───────────────
  5: {
    barDir:      'horizontal',
    barH:        0.080,
    barD:        0.020,
    barGap:      0.090,
    barBotMar:   0.030,
    sectionBotOff: 0.250,
    stileW:      0.020,
    stileD:      0.040,
    stileExt:    0.030,
    brkLen:      0.070,
    brkYUOff:    0.250,
    brkYLOff:    0.250,
    postW:       0.080,
    postD:       0.060,
    postExtra:   0.000,
    capW:        0.096,
    capD:        0.076,
    capH:        0.018,
    barW:        0.020,
    railH:       0.040,  railBotH:0.040,  railD:   0.040,
    railBot:     0.030,  railTopOff: 0.030,
  },

  // ── №6: Рамка горизонтальна ────────────────────────────────────
  6: {
    barDir:        'horizontal',
    topBotRail:    true,
    topBotRailH:   0.020,
    barH:          0.080,
    barD:          0.020,
    barGap:        0.090,
    barBotMar:     0.090,
    smallBarH:     0.040,
    sectionBotOff: 0.250,
    stileW:        0.020,
    stileD:        0.040,
    stileExt:      0.030,
    brkLen:        0.070,
    brkYUOff:      0.250,
    brkYLOff:      0.250,
    postW:         0.080,
    postD:         0.060,
    postExtra:     0.000,
    capW:          0.096,
    capD:          0.076,
    capH:          0.018,
    barW:          0.020,
    railH:         0.040,  railBotH:0.040,  railD:   0.040,
    railBot:       0.030,  railTopOff: 0.030,
  },

  // ── №7: Рамка + вертикальні прути ─────────────────────────────
  7: {
    barDir:        'horizontal',
    topBotRail:    true,
    topBotRailH:   0.020,
    verticalInner: true,
    innerBarW:     0.020,
    innerBarD:     0.040,
    innerBarGap:   0.110,
    sectionBotOff: 0.250,
    stileW:        0.020,
    stileD:        0.040,
    stileExt:      0.030,
    brkLen:        0.070,
    brkYUOff:      0.250,
    brkYLOff:      0.250,
    postW:         0.080,
    postD:         0.060,
    postExtra:     0.000,
    capW:          0.096,
    capD:          0.076,
    capH:          0.018,
    barW:          0.020,  barH: 0.080,  barD: 0.020,
    barGap:        0.110,  barBotMar: 0.030,
    railH:         0.040,  railBotH:0.040,  railD:   0.040,
    railBot:       0.030,  railTopOff: 0.030,
  },

  // ── №8: Рамка + вертикальні прути через один різної ширини ────
  8: {
    barDir:         'horizontal',
    topBotRail:     true,
    topBotRailH:    0.020,
    verticalInner:  true,
    innerBarAlt:    true,
    innerBarWide:   0.080,
    innerBarNarrow: 0.040,
    innerBarD:      0.040,
    innerBarGap:    0.100,
    innerBarSideMar:0.040,
    sectionBotOff:  0.250,
    stileW:         0.020,
    stileD:         0.040,
    stileExt:       0.030,
    brkLen:         0.070,
    brkYUOff:       0.250,
    brkYLOff:       0.250,
    postW:          0.080,
    postD:          0.060,
    postExtra:      0.000,
    capW:           0.096,
    capD:           0.076,
    capH:           0.018,
    barW:           0.020,  barH: 0.080,  barD: 0.020,
    barGap:         0.130,  barBotMar: 0.030,
    railH:          0.040,  railBotH:0.040,  railD:   0.040,
    railBot:        0.030,  railTopOff: 0.030,
  },

};

// ─── FENCE CONFIGURATION ──────────────────────────────────────
// Fence configuration — modified by the form controls
const ST = {
  length:    5,           // total fence length, metres
  height:    2.0,         // fence height, metres
  span:      2.5,         // span between posts, metres
  profile:   20,          // tube profile size, mm (Сквер Пайп: 20×20mm bars)
  fill:      'vertical',  // infill pattern: vertical | horizontal | cross | wide
  postType:  'square',    // post cross-section: square | bigSquare | round
  color:     '#0E0E10',   // hex colour applied to all metal parts
  colorName: 'Чорний RAL 9005',
  package:    'fence',     // what to build: fence | fence+gate-small | fence+gate | fence+gate+small
  fenceStyle: 1           // fence design: 1 = Сквер Пайп, 2+ added as photos provided
};
