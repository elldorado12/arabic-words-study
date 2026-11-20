/* P1 parse pretest — phone version (jsPsych 8.4.0 + @jspsych/extension-pipe 0.2.0).
 *
 * BEFORE DEPLOYING: set DATAPIPE_ID below (12 characters, from your DataPipe dashboard,
 * storage provider Google Drive), switch on condition assignment with 2 conditions there,
 * and put the 48 audio files in audio/ (s01.mp3 ... s48.mp3, made by make_experiment_audio.py).
 * Open the page with ?pilot=1 for your own test runs: nothing is sent to DataPipe and the
 * data file is offered as a download at the end instead.
 *
 * Saving: the DataPipe extension sends every trial as it finishes (so people who stop
 * early are still recorded; DataPipe recovers them as a .partial.json file) and submits
 * the complete file <participant>.csv at the end. There is no save trial.
 * Consent is plain HTML in index.html, before jsPsych starts: a person who declines never
 * starts the experiment, so nothing about them is recorded.
 *
 * Design: version A = /b/ endpoints, version B = /d/ endpoints, assigned in turn by
 * DataPipe (coin flip if assignment fails; recorded in version_source).
 * MAIN block: each word plays once; 'which word is on the same wazn?' (2 real words +
 * "don't know"); choice and RT logged. FINAL block: each word replayed once; 'which is the
 * root?' (2 options + "don't know"); if the hollow option is chosen, one follow-up asks و or
 * ي; then an optional 'reminds you of a word?' box.
 * The page holds no answer key: audio files have opaque codes, option words are unlabelled
 * and their stored order is random. Scoring happens offline with P1_pretest_analyse.py.
 */

const DATAPIPE_ID = 'PASTE_DATAPIPE_EXPERIMENT_ID_HERE';
const AUDIO_DIR = 'audio/';
const DONT_KNOW = 'لا أدري / ليست أياً منهما';
const DONT_KNOW_ROOT = 'لا أدري / غير ذلك';
const URLP = new URLSearchParams(window.location.search);
const PILOT = URLP.get('pilot') === '1';
const SAVE_ON = !PILOT && !DATAPIPE_ID.startsWith('PASTE');

let jsPsych = null;
let PID = null;
const audio = code => AUDIO_DIR + code + '.mp3';
const shuffle = a => jsPsych.randomization.shuffle(a.slice());
const isDontKnow = s => s === DONT_KNOW || s === DONT_KNOW_ROOT;

function buttonHtml(extraClass) {
  return (choice, i) => {
    const cls = isDontKnow(choice) ? 'jspsych-btn dontknow' : ('jspsych-btn ' + (extraClass || ''));
    return `<button class="${cls}">${choice}</button>`;
  };
}

function offerDownload(message) {
  document.body.innerHTML =
    `<div class="jspsych-content"><p class="center">${message}</p>` +
    '<p class="center"><button id="dl" class="jspsych-btn">تنزيل ملف الإجابات</button></p></div>';
  document.getElementById('dl').onclick = () => jsPsych.data.get().localSave('csv', `P1_pretest_${PID}.csv`);
}

async function getVersion() {
  if (!SAVE_ON) return { version: Math.random() < 0.5 ? 'A' : 'B', source: PILOT ? 'pilot_random' : 'random_no_id' };
  try {
    const c = await jsPsychExtensionPipe.getCondition(DATAPIPE_ID);
    if (typeof c === 'number') return { version: c % 2 === 0 ? 'A' : 'B', source: 'datapipe' };
  } catch (e) { /* fall through: both versions are complete, so a coin flip is safe here */ }
  return { version: Math.random() < 0.5 ? 'A' : 'B', source: 'random_fallback' };
}

document.getElementById('decline').onclick = () => {
  document.getElementById('consent').innerHTML = '<p class="center">شكراً لوقتك. يمكنك إغلاق الصفحة.</p>';
};
document.getElementById('agree').onclick = () => { start(); };

async function start() {
  document.getElementById('consent').remove();
  // initJsPsych runs inside the tap, so its audio context is created during a user gesture (needed on iPhones)
  jsPsych = initJsPsych({
    extensions: SAVE_ON ? [{
      type: jsPsychExtensionPipe,
      params: {
        experiment_id: DATAPIPE_ID,
        filename: () => `${PID}.csv`,
        wait_message: '<p class="center">جارٍ حفظ إجاباتك… لا تغلق الصفحة.</p>',
        done_message: '<p class="center"><b>شكراً جزيلاً!</b> حُفظت إجاباتك. يمكنك إغلاق الصفحة.</p>',
        on_save: result => {
          if (!result.ok) offerDownload('<b>شكراً جزيلاً!</b> لم نتمكن من حفظ الإجابات تلقائياً. اضغط الزر لتنزيل ملف إجاباتك، ثم أرسله إلى الباحث.');
        }
      }
    }] : [],
    on_finish: () => {
      if (!SAVE_ON) offerDownload(PILOT ? 'انتهت التجربة (وضع التجربة الذاتية). نزّل الملف لفحصه.' :
                                          'انتهت التجربة. لم يُضبط معرّف DataPipe بعد، فلم تُرسل البيانات. نزّل الملف.');
    }
  });
  try { jsPsych.pluginAPI.audioContext(); } catch (e) { /* HTML5 audio fallback */ }
  PID = jsPsych.randomization.randomID(10);
  const { version, source } = await getVersion();
  jsPsych.data.addProperties({
    participant_id: PID, version: version, version_source: source, pilot: PILOT,
    user_agent: navigator.userAgent, screen_w: window.screen.width, screen_h: window.screen.height,
    started_at: new Date().toISOString(), experiment_build: 'P1_pretest_v2_2026-11-20'
  });
  const T = [];

  /* 2. Background */
  T.push({
    type: jsPsychSurveyHtmlForm,
    preamble: '<p class="center"><b>معلومات عامة</b></p>',
    html: `
      <p>في أي بلد نشأت؟<br><input type="text" name="country" required></p>
      <p>ما لهجتك الأم؟ (مثلاً: مغربية، مصرية، شامية، خليجية…)<br><input type="text" name="dialect" required></p>
      <p>هل درست الصرف والنحو العربي دراسة نظامية؟</p>
      <label class="choice"><input type="radio" name="grammar" value="yes" required> نعم</label>
      <label class="choice"><input type="radio" name="grammar" value="some"> قليلاً</label>
      <label class="choice"><input type="radio" name="grammar" value="no"> لا</label>`,
    button_label: 'التالي',
    data: { task: 'background' }
  });

  /* 3. Preload all audio */
  T.push({
    type: jsPsychPreload,
    audio: ALL_AUDIO_CODES.map(audio),
    show_progress_bar: true,
    message: '<p class="center">جارٍ تحميل الأصوات…</p>',
    continue_after_error: false,
    error_message: '<p class="center">تعذّر تحميل الأصوات. تأكد من اتصالك بالإنترنت ثم أعد فتح الرابط.</p>',
    max_load_time: 120000,
    data: { task: 'preload' }
  });

  /* 4. Audio check (up to 3 attempts) */
  let checkAttempts = 0;
  const checkChoices = shuffle([STIM_AUDIO_CHECK.correct, ...STIM_AUDIO_CHECK.foils]);
  T.push({
    timeline: [{
      type: jsPsychAudioButtonResponse,
      stimulus: audio(STIM_AUDIO_CHECK.code),
      choices: checkChoices,
      prompt: '<p class="prompt">اختبار الصوت: أيّ كلمة سمعت؟</p>',
      button_html: buttonHtml(),
      response_allowed_while_playing: false,
      data: { task: 'audio_check', stim_code: STIM_AUDIO_CHECK.code },
      on_finish: d => {
        checkAttempts += 1;
        d.chosen = checkChoices[d.response];
        d.correct = d.chosen === STIM_AUDIO_CHECK.correct;
        d.attempt = checkAttempts;
      }
    }, {
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: '<p class="center">لم نسمع الإجابة المتوقعة. ارفع الصوت أو استخدم السماعات، ثم حاول مرة أخرى.</p>',
        choices: ['حاول مرة أخرى'],
        button_html: buttonHtml(),
        data: { task: 'audio_check_retry' }
      }],
      conditional_function: () => {
        const last = jsPsych.data.get().filter({ task: 'audio_check' }).last(1).values()[0];
        return !last.correct && checkAttempts < 3;
      }
    }],
    loop_function: () => {
      const last = jsPsych.data.get().filter({ task: 'audio_check' }).last(1).values()[0];
      return !last.correct && checkAttempts < 3;
    }
  });

  /* 5. Instructions + wazn practice with feedback */
  T.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <p class="center"><b>الجزء الأول</b></p>
      <p>ستسمع كلمة واحدة في كل مرة، <b>مرة واحدة فقط</b>. بعد انتهاء الكلمة تظهر كلمتان حقيقيتان.</p>
      <p>اختر الكلمة التي على <b>نفس وزن</b> الكلمة التي سمعتها. إن لم تستطع أن تقرر، اختر «${DONT_KNOW}».</p>
      <p>لا توجد إجابة صحيحة أو خاطئة في الكلمات المخترعة؛ نريد انطباعك الأول، فأجب بسرعة.</p>
      <p>نبدأ بثلاث كلمات للتدريب.</p>`,
    choices: ['ابدأ التدريب'],
    button_html: buttonHtml(),
    data: { task: 'instructions_main' }
  });
  for (const p of STIM_PRACTICE_WAZN) {
    const ch = shuffle([p.correct, p.wrong]).concat([DONT_KNOW]);
    T.push({
      type: jsPsychAudioButtonResponse,
      stimulus: audio(p.code),
      choices: ch,
      prompt: '<p class="prompt">أيّ الكلمتين على نفس وزن الكلمة التي سمعتها؟</p>',
      button_html: buttonHtml(),
      response_allowed_while_playing: false,
      data: { task: 'practice_wazn', stim_code: p.code, options_shown: JSON.stringify(ch) },
      on_finish: d => { d.chosen = ch[d.response]; d.correct = d.chosen === p.correct; }
    });
    T.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: () => {
        const last = jsPsych.data.get().last(1).values()[0];
        return last.correct
          ? `<p class="feedback-ok">أحسنت.</p><p class="center">«${p.correct}» على نفس الوزن.</p>`
          : `<p class="feedback-no">ليس تماماً.</p><p class="center">الكلمة التي على نفس الوزن هي «${p.correct}».</p>`;
      },
      choices: ['التالي'],
      button_html: buttonHtml(),
      data: { task: 'practice_feedback' }
    });
  }
  T.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p class="center">انتهى التدريب. الكلمات القادمة معظمها <b>مخترعة</b>. لن تظهر بعد الآن إجابة صحيحة أو خاطئة.</p>',
    choices: ['ابدأ'],
    button_html: buttonHtml(),
    data: { task: 'start_main' }
  });

  /* 6. MAIN block: wazn choice, word heard once */
  const items = jsPsych.randomization.shuffleNoRepeats(STIM_MAIN[version].slice(), (a, b) => a.pair === b.pair);
  items.forEach((it, idx) => {
    const ch = shuffle(it.wazn).concat([DONT_KNOW]);
    T.push({
      type: jsPsychAudioButtonResponse,
      stimulus: audio(it.code),
      choices: ch,
      prompt: '<p class="prompt">أيّ الكلمتين على نفس وزن الكلمة التي سمعتها؟</p>',
      button_html: buttonHtml(),
      response_allowed_while_playing: false,
      data: { task: 'wazn', stim_code: it.code, pair: it.pair, trial_in_block: idx + 1,
              options_shown: JSON.stringify(ch) },
      on_finish: d => { d.chosen = ch[d.response]; d.dont_know = isDontKnow(d.chosen); }
    });
  });

  /* 7. FINAL block: root question */
  T.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <p class="center"><b>الجزء الثاني (الأخير)</b></p>
      <p>ستسمع الكلمات نفسها مرة أخرى. هذه المرة اختر ما تظنه <b>جذر</b> الكلمة.</p>
      <p>مثال: جذر «مكتوب» هو «ك ت ب».</p>`,
    choices: ['التالي'],
    button_html: buttonHtml(),
    data: { task: 'instructions_root' }
  });
  {
    const p = STIM_PRACTICE_ROOT;
    const ch = shuffle([p.correct, p.wrong]).concat([DONT_KNOW_ROOT]);
    T.push({
      type: jsPsychAudioButtonResponse,
      stimulus: audio(p.code),
      choices: ch,
      prompt: '<p class="prompt">تدريب: ما جذر هذه الكلمة في رأيك؟</p>',
      button_html: buttonHtml('root-opt'),
      response_allowed_while_playing: false,
      data: { task: 'practice_root', stim_code: p.code, options_shown: JSON.stringify(ch) },
      on_finish: d => { d.chosen = ch[d.response]; d.correct = d.chosen === p.correct; }
    });
    T.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: () => {
        const last = jsPsych.data.get().last(1).values()[0];
        return (last.correct ? '<p class="feedback-ok">أحسنت.</p>' : '<p class="feedback-no">ليس تماماً.</p>') +
          `<p class="center">جذر «مكتوب» هو «${p.correct}». الآن الكلمات المخترعة: لا توجد إجابة صحيحة أو خاطئة.</p>`;
      },
      choices: ['ابدأ'],
      button_html: buttonHtml(),
      data: { task: 'practice_feedback' }
    });
  }
  const items2 = jsPsych.randomization.shuffleNoRepeats(STIM_MAIN[version].slice(), (a, b) => a.pair === b.pair);
  items2.forEach((it, idx) => {
    const ch = shuffle(it.root).concat([DONT_KNOW_ROOT]);
    let chosenRoot = null;
    T.push({
      type: jsPsychAudioButtonResponse,
      stimulus: audio(it.code),
      choices: ch,
      prompt: '<p class="prompt">ما جذر هذه الكلمة في رأيك؟</p>',
      button_html: buttonHtml('root-opt'),
      response_allowed_while_playing: false,
      data: { task: 'root', stim_code: it.code, pair: it.pair, trial_in_block: idx + 1,
              options_shown: JSON.stringify(ch) },
      on_finish: d => { d.chosen = ch[d.response]; chosenRoot = d.chosen; d.dont_know = isDontKnow(d.chosen); }
    });
    T.push({
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: () => `<p class="prompt">اخترت «${chosenRoot}». ما الحرف الأوسط في هذا الجذر؟</p>`,
        choices: ['و', 'ي', 'لا أدري'],
        button_html: buttonHtml('root-opt'),
        data: { task: 'hollow_vowel', stim_code: it.code },
        on_finish: d => { d.chosen = ['و', 'ي', 'لا أدري'][d.response]; }
      }],
      conditional_function: () => chosenRoot !== null && chosenRoot.includes('و/ي')
    });
    T.push({
      type: jsPsychSurveyHtmlForm,
      html: '<p class="center">هل تذكّرك هذه الكلمة بكلمة عربية حقيقية؟ اكتبها، أو اترك الخانة فارغة.</p>' +
            '<p class="center"><input type="text" name="reminds" autocomplete="off"></p>',
      button_label: 'التالي',
      data: { task: 'reminds', stim_code: it.code }
    });
  });

  /* 8. End questions */
  T.push({
    type: jsPsychSurveyHtmlForm,
    preamble: '<p class="center"><b>سؤالان أخيران</b></p>',
    html: `
      <p>كيف استمعت إلى الأصوات؟</p>
      <label class="choice"><input type="radio" name="listening" value="headphones" required> سماعات</label>
      <label class="choice"><input type="radio" name="listening" value="speaker"> مكبّر صوت الهاتف أو الحاسوب</label>
      <p>هل حدثت أي مشكلة (صوت لا يعمل، انقطاع…)؟ (اختياري)<br><input type="text" name="problems"></p>`,
    button_label: 'إنهاء',
    data: { task: 'end_questions' }
  });

  await jsPsych.run(T);
}
