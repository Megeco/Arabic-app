import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2, CheckCircle2, XCircle, RotateCcw, BookOpen, Ear, Shuffle, Star,
  PlayCircle, Newspaper, ScrollText, Languages, Mic, MicOff, TrendingUp, Brain
} from 'lucide-react';
import { PHRASES } from './phrases';

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[؟?!.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getStoredProgress() {
  try {
    const raw = localStorage.getItem('arabic-dad-progress-v3');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredProgress(progress) {
  try {
    localStorage.setItem('arabic-dad-progress-v3', JSON.stringify(progress));
  } catch {}
}

function getItemStats(progress, id) {
  return progress[id] || { correct: 0, wrong: 0, mastered: false, spoken: 0 };
}

function buildAdaptivePool(phrases, progress, track) {
  const filtered = track === 'All Tracks' ? phrases : phrases.filter((p) => p.track === track);
  const weak = filtered.filter((p) => {
    const s = getItemStats(progress, p.id);
    return s.wrong >= s.correct || (!s.mastered && s.correct <= 1);
  });
  const fresh = filtered.filter((p) => {
    const s = getItemStats(progress, p.id);
    return s.correct === 0 && s.wrong === 0;
  });
  const strong = filtered.filter((p) => getItemStats(progress, p.id).mastered);
  const steady = filtered.filter((p) => !weak.includes(p) && !fresh.includes(p) && !strong.includes(p));
  const mixed = [
    ...shuffle(weak).slice(0, 6),
    ...shuffle(fresh).slice(0, 6),
    ...shuffle(steady).slice(0, 6),
    ...shuffle(strong).slice(0, 3),
  ];
  return mixed.length ? mixed : shuffle(filtered);
}

function buildLessonItems(pool, lessonKind = 'morning') {
  const base = shuffle(pool).slice(0, lessonKind === 'morning' ? 6 : 5);
  if (!base.length) return [];
  const [first, second = base[0], third = base[0], fourth = base[1] || base[0], fifth = base[2] || base[0]] = base;
  if (lessonKind === 'morning') {
    return [
      { type: 'learn', item: first },
      { type: 'learn', item: second },
      { type: 'mcq', item: first, choices: shuffle([first.english, second.english, third.english]).slice(0, 3) },
      { type: 'typing', item: second },
      { type: 'learn', item: third },
      { type: 'listen', item: third, choices: shuffle([third.english, fourth.english, fifth.english]).slice(0, 3) },
      { type: 'reading', item: fourth },
      { type: 'review', item: fifth },
    ];
  }
  return [
    { type: 'review', item: first },
    { type: 'typing', item: second },
    { type: 'mcq', item: third, choices: shuffle([third.english, first.english, second.english]).slice(0, 3) },
    { type: 'listen', item: first, choices: shuffle([first.english, second.english, fourth.english]).slice(0, 3) },
    { type: 'reading', item: fourth },
    { type: 'review', item: fifth },
  ];
}

function browserHasSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function IconButton({ children, onClick, secondary = false, disabled = false }) {
  return (
    <button className={`button ${secondary ? 'button-secondary' : 'button-primary'}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default function App() {
  const [mode, setMode] = useState('lesson');
  const [track, setTrack] = useState('All Tracks');
  const [lessonKind, setLessonKind] = useState('morning');
  const [progress, setProgress] = useState({});
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [lesson, setLesson] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const dailyGoal = 2;
  const streak = 4;

  useEffect(() => {
    setProgress(getStoredProgress());
    setVoiceSupported(browserHasSpeechRecognition());
  }, []);

  useEffect(() => {
    saveStoredProgress(progress);
  }, [progress]);

  const tracks = ['All Tracks', ...new Set(PHRASES.map((p) => p.track))];

  const rebuildLesson = useCallback(() => {
    const pool = adaptiveMode
      ? buildAdaptivePool(PHRASES, progress, track)
      : shuffle(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track));
    setLesson(buildLessonItems(pool, lessonKind));
    setStepIndex(0);
    setInput('');
    setFeedback(null);
    setShowAnswer(false);
    setSpokenText('');
    setVoiceFeedback(null);
    setIsListening(false);
  }, [adaptiveMode, progress, track, lessonKind]);

  useEffect(() => {
    rebuildLesson();
  }, [rebuildLesson]);

  const currentStep = lesson[stepIndex] || null;
  const current = currentStep?.item || PHRASES[0];
  const lessonComplete = lesson.length > 0 && stepIndex >= lesson.length;

  const masteredCount = useMemo(() => Object.values(progress).filter((p) => p?.mastered).length, [progress]);
  const correctToday = useMemo(() => Object.values(progress).reduce((acc, p) => acc + (p?.correct || 0), 0), [progress]);
  const overallProgress = Math.min(100, Math.round((masteredCount / PHRASES.length) * 100));
  const lessonProgress = lesson.length ? Math.round((Math.min(stepIndex, lesson.length) / lesson.length) * 100) : 0;

  const categoryStats = useMemo(() => {
    const cats = [...new Set(PHRASES.map((p) => p.category))];
    return cats.map((cat) => {
      const items = PHRASES.filter((p) => p.category === cat);
      const mastered = items.filter((p) => progress[p.id]?.mastered).length;
      return { cat, total: items.length, mastered };
    });
  }, [progress]);

  const speak = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const markProgress = (isCorrect, spoken = false) => {
    setProgress((prev) => {
      const prevItem = getItemStats(prev, current.id);
      const updated = {
        ...prevItem,
        correct: prevItem.correct + (isCorrect ? 1 : 0),
        wrong: prevItem.wrong + (isCorrect ? 0 : 1),
        spoken: prevItem.spoken + (spoken ? 1 : 0),
      };
      updated.mastered = updated.correct >= 3 && updated.correct > updated.wrong;
      return { ...prev, [current.id]: updated };
    });
  };

  const goNext = () => {
    setInput('');
    setFeedback(null);
    setShowAnswer(false);
    setSpokenText('');
    setVoiceFeedback(null);
    setStepIndex((s) => s + 1);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const checkTyping = () => {
    const ok = normalizeText(input) === normalizeText(current.answer) || normalizeText(input) === normalizeText(current.english);
    setFeedback(ok ? 'correct' : 'wrong');
    markProgress(ok);
  };

  const checkChoice = (choice) => {
    const ok = normalizeText(choice) === normalizeText(current.english);
    setFeedback(ok ? 'correct' : 'wrong');
    markProgress(ok);
  };

  const startVoicePractice = () => {
    if (!voiceSupported || typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setSpokenText('');
      setVoiceFeedback(null);
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setSpokenText(transcript);
      const ok = normalizeText(transcript) === normalizeText(current.arabic);
      setVoiceFeedback(ok ? 'correct' : 'heard');
      markProgress(ok, true);
    };
    recognition.onerror = () => {
      setVoiceFeedback('error');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoicePractice = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  const resetAll = () => {
    localStorage.removeItem('arabic-dad-progress-v3');
    setProgress({});
    rebuildLesson();
  };

  const weakPractice = () => {
    const weakPool = PHRASES.filter((p) => {
      const s = getItemStats(progress, p.id);
      return s.wrong >= s.correct || !s.mastered;
    });
    setLesson(buildLessonItems(shuffle(weakPool.length ? weakPool : PHRASES), 'evening'));
    setStepIndex(0);
    setInput('');
    setFeedback(null);
    setShowAnswer(false);
  };

  const renderLessonStep = () => {
    if (!currentStep) return null;

    if (currentStep.type === 'learn' || currentStep.type === 'review' || currentStep.type === 'reading') {
      return (
        <div className="space-y">
          <div className="row-between">
            <span className="pill soft">{current.category}</span>
            <span className="pill">{current.level}</span>
          </div>
          <div className="lesson-center">
            <div className="arabic-big" dir="rtl">{current.arabic}</div>
            <div className="translit">{current.transliteration}</div>
            <div className="english-big">{current.english}</div>
            <div className="muted">{current.notes}</div>
          </div>
          <div className="center">
            <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Play Arabic</IconButton>
          </div>
          <div className="stack">
            {voiceSupported && (
              <div className="subpanel">
                <div className="panel-title">Say the Arabic aloud</div>
                <div className="button-grid-2">
                  <IconButton secondary onClick={isListening ? stopVoicePractice : startVoicePractice}>
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />} {isListening ? 'Stop' : 'Voice practice'}
                  </IconButton>
                  <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Hear again</IconButton>
                </div>
                {spokenText && <div className="muted top-gap">Heard: {spokenText}</div>}
                {voiceFeedback === 'correct' && <div className="ok-msg top-gap">Good pronunciation match.</div>}
                {voiceFeedback === 'heard' && <div className="muted top-gap">Good try. The phrase sounded a bit different.</div>}
                {voiceFeedback === 'error' && <div className="error-msg top-gap">Voice input did not work this time.</div>}
              </div>
            )}
            <IconButton onClick={goNext}>Continue</IconButton>
          </div>
        </div>
      );
    }

    if (currentStep.type === 'typing') {
      return (
        <div className="space-y">
          <div className="row-between">
            <span className="pill soft">Typing</span>
            <span className="pill">{current.level}</span>
          </div>
          <div className="lesson-center">
            <div className="arabic-big" dir="rtl">{current.arabic}</div>
            <div className="translit">{current.transliteration}</div>
            <div className="muted">Type the meaning in English</div>
          </div>
          <div className="center">
            <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Play Arabic</IconButton>
          </div>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type in English" className="text-input" />
          <div className="button-grid-2">
            <IconButton onClick={checkTyping}>Check</IconButton>
            <IconButton secondary onClick={() => setShowAnswer(true)}>Show answer</IconButton>
          </div>
          {showAnswer && <div className="subpanel"><div className="english-big">{current.english}</div></div>}
          {feedback === 'correct' && <div className="feedback ok"><CheckCircle2 size={20} /> <div><strong>Correct</strong><div className="muted">Nicely done.</div></div></div>}
          {feedback === 'wrong' && <div className="feedback error"><XCircle size={20} /> <div><strong>Not quite</strong><div className="muted">Answer: {current.english}</div></div></div>}
          <IconButton secondary onClick={goNext}>Next step</IconButton>
        </div>
      );
    }

    if (currentStep.type === 'mcq' || currentStep.type === 'listen') {
      const isListen = currentStep.type === 'listen';
      return (
        <div className="space-y">
          <div className="row-between">
            <span className="pill soft">{isListen ? 'Listening' : 'Choose the meaning'}</span>
            <span className="pill">{current.level}</span>
          </div>
          <div className="lesson-center">
            {isListen ? (
              <>
                <div className="muted">Tap to hear the Arabic, then choose the meaning.</div>
                <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Play Arabic</IconButton>
              </>
            ) : (
              <>
                <div className="arabic-big" dir="rtl">{current.arabic}</div>
                <div className="translit">{current.transliteration}</div>
              </>
            )}
          </div>
          <div className="stack">
            {currentStep.choices.map((choice) => (
              <button key={choice} className="choice-button" onClick={() => checkChoice(choice)}>{choice}</button>
            ))}
          </div>
          {feedback === 'correct' && <div className="feedback ok"><CheckCircle2 size={20} /> <div><strong>Correct</strong><div className="muted">That is right.</div></div></div>}
          {feedback === 'wrong' && <div className="feedback error"><XCircle size={20} /> <div><strong>Not quite</strong><div className="muted">Correct answer: {current.english}</div></div></div>}
          <IconButton secondary onClick={goNext}>Next step</IconButton>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="card">
          <div className="card-header">
            <div>
              <h1>Arabic Companion</h1>
              <p>A calm Arabic lesson app for Dad.</p>
            </div>
            <span className="pill dark">Age-friendly</span>
          </div>

          <div className="stats-grid">
            <div className="mini-card"><span>Mastered</span><strong>{masteredCount}</strong></div>
            <div className="mini-card"><span>Daily lessons</span><strong>{dailyGoal}</strong></div>
            <div className="mini-card"><span>Library size</span><strong>{PHRASES.length}</strong></div>
          </div>

          <div className="progress-block">
            <div className="row-between"><span>Overall progress</span><span>{overallProgress}%</span></div>
            <div className="progress-bar"><div style={{ width: `${overallProgress}%` }} /></div>
          </div>
          <div className="progress-card">
            <div className="row-between"><span>Current lesson</span><span>{lessonProgress}%</span></div>
            <div className="progress-bar thin"><div style={{ width: `${lessonProgress}%` }} /></div>
          </div>
        </div>

        <div className="card">
          <div className="tabs-grid">
            {[
              ['lesson', <BookOpen size={16} />, 'Lesson'],
              ['listen', <Ear size={16} />, 'Listen'],
              ['phrasebook', <ScrollText size={16} />, 'Phrases'],
              ['review', <Star size={16} />, 'Review'],
            ].map(([value, icon, label]) => (
              <button key={value} className={`tab-button ${mode === value ? 'active' : ''}`} onClick={() => setMode(value)}>
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="chip-row top-gap">
            {tracks.map((t) => (
              <button key={t} className={`chip ${track === t ? 'chip-active' : ''}`} onClick={() => setTrack(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="button-grid-2 top-gap">
            <button className="toggle-card" onClick={() => setLessonKind((v) => (v === 'morning' ? 'evening' : 'morning'))}>
              <Brain size={16} /> {lessonKind === 'morning' ? 'Morning lesson' : 'Evening lesson'}
            </button>
            <button className={`toggle-card ${adaptiveMode ? 'toggle-active' : ''}`} onClick={() => setAdaptiveMode((v) => !v)}>
              <TrendingUp size={16} /> Adaptive {adaptiveMode ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {mode === 'lesson' && (
          <div className="card">
            {lessonComplete ? (
              <div className="lesson-center">
                <div className="title-big">Lesson complete 🎉</div>
                <div className="muted">A clean stopping point, just like Duolingo.</div>
                <div className="stack top-gap">
                  <IconButton onClick={rebuildLesson}>Start next lesson</IconButton>
                  <IconButton secondary onClick={() => setMode('review')}>Go to review</IconButton>
                </div>
              </div>
            ) : (
              <>
                <div className="row-between">
                  <span className="pill soft">Step {stepIndex + 1} / {lesson.length}</span>
                  <span className="muted">{current.track}</span>
                </div>
                <div className="top-gap">{renderLessonStep()}</div>
              </>
            )}
          </div>
        )}

        {mode === 'listen' && (
          <div className="card">
            <h2>Listening practice</h2>
            <p className="muted">Tap a phrase to hear it in Arabic.</p>
            <div className="stack top-gap">
              {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).slice(0, 14).map((item) => (
                <button key={item.id} className="list-card" onClick={() => speak(item.arabic)}>
                  <div className="row-between">
                    <div>
                      <div className="arabic-mid" dir="rtl">{item.arabic}</div>
                      <div className="translit small">{item.transliteration}</div>
                      <div className="muted">{item.english}</div>
                    </div>
                    <PlayCircle size={22} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'phrasebook' && (
          <div className="card">
            <h2>Phrasebook & reading bank</h2>
            <p className="muted">Browse by track: daily Arabic, reading Arabic, history, poetry, travel, and culture.</p>
            <div className="stack top-gap">
              {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).map((item) => (
                <div key={item.id} className="phrase-card">
                  <div className="row-between">
                    <span className="pill soft">{item.category}</span>
                    <div className="row">
                      <span className="pill">{item.level}</span>
                      <button className="icon-only" onClick={() => speak(item.arabic)}><Volume2 size={16} /></button>
                    </div>
                  </div>
                  <div className="arabic-mid top-gap" dir="rtl">{item.arabic}</div>
                  <div className="translit small">{item.transliteration}</div>
                  <div className="english-mid">{item.english}</div>
                  <div className="muted">{item.notes}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'review' && (
          <div className="card">
            <h2>Review & progress</h2>
            <p className="muted">Adaptive mode surfaces weaker items first, then adds stronger items to keep him moving ahead.</p>
            <div className="stack top-gap">
              {categoryStats.map((row) => (
                <div key={row.cat} className="phrase-card">
                  <div className="row-between"><strong>{row.cat}</strong><span className="muted">{row.mastered}/{row.total}</span></div>
                  <div className="progress-bar thin top-gap"><div style={{ width: `${(row.mastered / row.total) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="stack top-gap">
              <IconButton onClick={weakPractice}><Shuffle size={16} /> Practice weak phrases</IconButton>
              <IconButton secondary onClick={resetAll}><RotateCcw size={16} /> Reset progress</IconButton>
            </div>
            <div className="subpanel top-gap">
              Correct answers logged: <strong>{correctToday}</strong><br />
              Voice practice appears only on browsers that expose speech recognition.<br />
              Progress is saved in the phone browser using local storage.
            </div>
          </div>
        )}

        <div className="card">
          <div className="row title-row"><Languages size={16} /> <strong>What this expanded version now does</strong></div>
          <ul className="feature-list">
            <li>Much larger built-in phrase bank to reduce repetition fast</li>
            <li>Daily use, travel, reading, history, poetry, proverbs, and culture</li>
            <li>Duolingo-like finite lessons with a clean stopping point</li>
            <li>Adaptive sequencing to keep weak items in rotation</li>
            <li>Optional voice recognition practice on supported mobile browsers</li>
          </ul>
          <div className="subpanel">
            <div className="row title-row"><Newspaper size={16} /> <strong>Next production upgrades</strong></div>
            Real audio files, better Arabic speech matching, even larger libraries, and optional AI-generated fresh lessons later.
          </div>
        </div>
      </div>
    </div>
  );
}
