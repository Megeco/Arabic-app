import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2, CheckCircle2, XCircle, RotateCcw, BookOpen, Ear, Shuffle, Star,
  PlayCircle, ScrollText, Languages, Mic, MicOff, TrendingUp, Brain,
  Download, Upload, Trophy, Sparkles
} from 'lucide-react';
import { PHRASES } from './phrases';

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/[؟?!.,']/g, '').replace(/\s+/g, ' ').trim();
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function getStoredProgress() {
  try {
    return JSON.parse(localStorage.getItem('arabic-dad-progress-v6') || '{}');
  } catch {
    return {};
  }
}
function saveStoredProgress(progress) {
  try {
    localStorage.setItem('arabic-dad-progress-v6', JSON.stringify(progress));
  } catch {}
}
function getStoredMeta() {
  try {
    return JSON.parse(
      localStorage.getItem('arabic-dad-meta-v6') ||
        '{"lessonsCompleted":0,"lastLessonNumber":0,"accomplishments":[],"lastGeneratedSession":"","lastCompletedSession":""}'
    );
  } catch {
    return {
      lessonsCompleted: 0,
      lastLessonNumber: 0,
      accomplishments: [],
      lastGeneratedSession: '',
      lastCompletedSession: ''
    };
  }
}
function saveStoredMeta(meta) {
  try {
    localStorage.setItem('arabic-dad-meta-v6', JSON.stringify(meta));
  } catch {}
}
function getStoredActiveLesson() {
  try {
    return JSON.parse(localStorage.getItem('arabic-dad-active-lesson-v6') || 'null');
  } catch {
    return null;
  }
}
function saveStoredActiveLesson(activeLesson) {
  try {
    localStorage.setItem('arabic-dad-active-lesson-v6', JSON.stringify(activeLesson));
  } catch {}
}
function clearStoredActiveLesson() {
  try {
    localStorage.removeItem('arabic-dad-active-lesson-v6');
  } catch {}
}
function getItemStats(progress, id) {
  return progress[id] || { correct: 0, wrong: 0, mastered: false, spoken: 0 };
}
function browserHasSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function getCurrentSessionInfo() {
  const now = new Date();
  const hour = now.getHours();
  const session = hour < 15 ? 'morning' : 'evening';
  const sessionLabel = session === 'morning' ? 'Morning' : 'Evening';
  const dateKey = now.toISOString().slice(0, 10);
  return {
    session,
    sessionLabel,
    sessionId: `${dateKey}-${session}`
  };
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
    ...shuffle(weak).slice(0, 8),
    ...shuffle(fresh).slice(0, 8),
    ...shuffle(steady).slice(0, 8),
    ...shuffle(strong).slice(0, 4)
  ];
  return mixed.length ? mixed : shuffle(filtered);
}
function generateTasksFromPhrases(base, lessonKind = 'morning') {
  if (!base.length) return [];
  const tasks = [];
  const selected = base.slice(0, lessonKind === 'morning' ? 8 : 7);
  const others = shuffle(selected);

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const alt1 = others[(i + 1) % others.length] || item;
    const alt2 = others[(i + 2) % others.length] || item;

    if (lessonKind === 'morning' || i < 3) {
      tasks.push({ type: 'learn', item });
    }

    tasks.push({
      type: 'mcq',
      item,
      choices: shuffle([item.english, alt1.english, alt2.english]).slice(0, 3)
    });

    tasks.push({ type: 'typing', item });

    tasks.push({
      type: 'listen',
      item,
      choices: shuffle([item.english, alt1.english, alt2.english]).slice(0, 3)
    });

    const words = item.arabic.split(' ');
    if (words.length > 1) {
      const missingIndex = Math.min(1, words.length - 1);
      const answer = words[missingIndex];
      const promptWords = [...words];
      promptWords[missingIndex] = '_____';

      tasks.push({
        type: 'fill_blank',
        item,
        promptArabic: promptWords.join(' '),
        blankAnswer: answer,
        options: shuffle([
          answer,
          alt1.arabic.split(' ')[0] || answer,
          alt2.arabic.split(' ')[0] || answer
        ]).slice(0, 3)
      });
    }

    tasks.push({ type: 'review', item });
  }

  return tasks.slice(0, lessonKind === 'morning' ? 40 : 32);
}
function buildLessonItems(pool, lessonKind = 'morning') {
  return generateTasksFromPhrases(
    shuffle(pool).slice(0, lessonKind === 'morning' ? 8 : 7),
    lessonKind
  );
}
function sanitizeImportedPhrase(p, idx) {
  return {
    id: p.id ?? (100000 + idx),
    track: p.track || 'Imported Lesson',
    category: p.category || 'Generated',
    level: p.level || 'B1',
    arabic: p.arabic || '',
    transliteration: p.transliteration || '',
    english: p.english || '',
    answer: (p.answer || p.english || '').toLowerCase(),
    notes: p.notes || 'Imported lesson phrase.'
  };
}
function importLessonJson(rawText) {
  const parsed = JSON.parse(rawText);
  const sourcePhrases = Array.isArray(parsed) ? parsed : (parsed.source_phrases || parsed.phrases || []);
  return sourcePhrases.map(sanitizeImportedPhrase).filter((p) => p.arabic && p.english);
}
function Button({ children, onClick, secondary = false, disabled = false }) {
  return (
    <button
      className={`button ${secondary ? 'button-secondary' : 'button-primary'}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function App() {
  const sessionInfo = useMemo(() => getCurrentSessionInfo(), []);
  const currentSessionId = sessionInfo.sessionId;
  const currentSessionLabel = sessionInfo.sessionLabel;

  const [mode, setMode] = useState('lesson');
  const [track, setTrack] = useState('All Tracks');
  const [lessonKind, setLessonKind] = useState(sessionInfo.session);
  const [progress, setProgress] = useState({});
  const [meta, setMeta] = useState({
    lessonsCompleted: 0,
    lastLessonNumber: 0,
    accomplishments: [],
    lastGeneratedSession: '',
    lastCompletedSession: ''
  });
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
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [externalLessonInfo, setExternalLessonInfo] = useState(null);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [theme, setTheme] = useState('mixed');
  const [difficulty, setDifficulty] = useState('A2/B1/B2');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [initLoaded, setInitLoaded] = useState(false);

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const dailyGoal = 2;

  useEffect(() => {
    setProgress(getStoredProgress());
    const storedMeta = getStoredMeta();
    setMeta(storedMeta);
    setLessonNumber((storedMeta.lastLessonNumber || 0) + 1);
    setVoiceSupported(browserHasSpeechRecognition());

    const active = getStoredActiveLesson();
    if (
      active &&
      active.sessionId === currentSessionId &&
      Array.isArray(active.lesson) &&
      active.lesson.length > 0 &&
      active.stepIndex < active.lesson.length
    ) {
      setLesson(active.lesson);
      setStepIndex(active.stepIndex || 0);
      setExternalLessonInfo(active.externalLessonInfo || null);
      setLessonNumber(active.lessonNumber || (storedMeta.lastLessonNumber || 0) + 1);
      setMode(active.mode || 'lesson');
    }

    setInitLoaded(true);
  }, [currentSessionId]);

  useEffect(() => {
    saveStoredProgress(progress);
  }, [progress]);

  useEffect(() => {
    saveStoredMeta(meta);
  }, [meta]);

  useEffect(() => {
    if (!initLoaded) return;

    if (lesson.length > 0 && stepIndex < lesson.length) {
      saveStoredActiveLesson({
        sessionId: currentSessionId,
        lesson,
        stepIndex,
        externalLessonInfo,
        lessonNumber,
        mode: 'lesson'
      });
    } else {
      clearStoredActiveLesson();
    }
  }, [initLoaded, currentSessionId, lesson, stepIndex, externalLessonInfo, lessonNumber]);

  const tracks = ['All Tracks', ...new Set(PHRASES.map((p) => p.track))];

  const rebuildLesson = useCallback(() => {
    const pool = adaptiveMode
      ? buildAdaptivePool(PHRASES, progress, track)
      : shuffle(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track));

    setExternalLessonInfo(null);
    setLesson(buildLessonItems(pool, lessonKind));
    setStepIndex(0);
    setInput('');
    setFeedback(null);
    setShowAnswer(false);
    setSpokenText('');
    setVoiceFeedback(null);
    setIsListening(false);
    setImportError('');
    setGenerateError('');
  }, [adaptiveMode, progress, track, lessonKind]);

  const currentStep = lesson[stepIndex] || null;
  const current = currentStep?.item || PHRASES[0];
  const lessonComplete = lesson.length > 0 && stepIndex >= lesson.length;
  const noLessonLoaded = lesson.length === 0;

  const masteredCount = useMemo(
    () => Object.values(progress).filter((p) => p?.mastered).length,
    [progress]
  );

  const correctToday = useMemo(
    () => Object.values(progress).reduce((acc, p) => acc + (p?.correct || 0), 0),
    [progress]
  );

  const overallProgress = Math.min(100, Math.round((masteredCount / PHRASES.length) * 100));
  const lessonProgress = lesson.length
    ? Math.round((Math.min(stepIndex, lesson.length) / lesson.length) * 100)
    : 0;

  const categoryStats = useMemo(() => {
    const cats = [...new Set(PHRASES.map((p) => p.category))];
    return cats.slice(0, 12).map((cat) => {
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
        spoken: prevItem.spoken + (spoken ? 1 : 0)
      };
      updated.mastered = updated.correct >= 3 && updated.correct > updated.wrong;
      return { ...prev, [current.id]: updated };
    });
  };

  const registerLessonCompletion = () => {
    clearStoredActiveLesson();

    setMeta((prev) => {
      const nextCompleted = prev.lessonsCompleted + 1;
      const nextAcc = [...(prev.accomplishments || [])];

      if (nextCompleted === 1 && !nextAcc.includes('Completed Lesson 1')) {
        nextAcc.push('Completed Lesson 1');
      }
      if (nextCompleted === 7 && !nextAcc.includes('Completed 7 lessons')) {
        nextAcc.push('Completed 7 lessons');
      }
      if (nextCompleted === 30 && !nextAcc.includes('Completed 30 lessons')) {
        nextAcc.push('Completed 30 lessons');
      }
      if (masteredCount >= 25 && !nextAcc.includes('Mastered 25 phrases')) {
        nextAcc.push('Mastered 25 phrases');
      }

      return {
        ...prev,
        lessonsCompleted: nextCompleted,
        lastLessonNumber: lessonNumber,
        lastCompletedSession: currentSessionId,
        accomplishments: nextAcc
      };
    });

    setLessonNumber((n) => n + 1);
  };

  const goNext = () => {
    setInput('');
    setFeedback(null);
    setShowAnswer(false);
    setSpokenText('');
    setVoiceFeedback(null);

    setStepIndex((s) => {
      const next = s + 1;
      if (next >= lesson.length) {
        registerLessonCompletion();
      }
      return next;
    });

    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const checkTyping = () => {
    const ok =
      normalizeText(input) === normalizeText(current.answer) ||
      normalizeText(input) === normalizeText(current.english);
    setFeedback(ok ? 'correct' : 'wrong');
    markProgress(ok);
  };

  const checkChoice = (choice) => {
    const ok =
      normalizeText(choice) === normalizeText(current.english) ||
      normalizeText(choice) === normalizeText(currentStep.blankAnswer);
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
    localStorage.removeItem('arabic-dad-progress-v6');
    localStorage.removeItem('arabic-dad-meta-v6');
    clearStoredActiveLesson();
    setProgress({});
    setMeta({
      lessonsCompleted: 0,
      lastLessonNumber: 0,
      accomplishments: [],
      lastGeneratedSession: '',
      lastCompletedSession: ''
    });
    setLessonNumber(1);
    setLesson([]);
    setStepIndex(0);
    setExternalLessonInfo(null);
    setGenerateError('');
    setImportError('');
  };

  const weakPractice = () => {
    const weakPool = PHRASES.filter((p) => {
      const s = getItemStats(progress, p.id);
      return s.wrong >= s.correct || !s.mastered;
    });

    setExternalLessonInfo(null);
    setLesson(generateTasksFromPhrases(shuffle(weakPool.length ? weakPool : PHRASES).slice(0, 8), 'evening'));
    setStepIndex(0);
    setInput('');
    setFeedback(null);
    setShowAnswer(false);
  };

  const loadImportedLesson = () => {
    try {
      const phrases = importLessonJson(importText);
      if (!phrases.length) throw new Error('No usable source phrases found in the JSON.');

      setLesson(generateTasksFromPhrases(phrases, lessonKind));
      setExternalLessonInfo({ count: phrases.length, source: 'Imported lesson' });
      setStepIndex(0);
      setInput('');
      setFeedback(null);
      setShowAnswer(false);
      setImportError('');
      setGenerateError('');
      setMode('lesson');

      setMeta((prev) => ({
        ...prev,
        lastGeneratedSession: currentSessionId
      }));
    } catch (err) {
      setImportError(err.message || 'Could not load the lesson JSON.');
    }
  };

  const generateLesson = useCallback(async () => {
    try {
      setGenerating(true);
      setGenerateError('');
      setImportError('');

      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_kind: lessonKind,
          theme,
          difficulty,
          task_target: lessonKind === 'morning' ? 40 : 32
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lesson generation failed.');

      const sourcePhrases = (data.source_phrases || data.phrases || [])
        .map(sanitizeImportedPhrase)
        .filter((p) => p.arabic && p.english);

      if (!sourcePhrases.length) throw new Error('No lesson phrases were returned.');

      setLesson(generateTasksFromPhrases(sourcePhrases, lessonKind));
      setExternalLessonInfo({ count: sourcePhrases.length, source: 'API lesson' });
      setImportText(JSON.stringify(data, null, 2));
      setStepIndex(0);
      setInput('');
      setFeedback(null);
      setShowAnswer(false);
      setMode('lesson');

      setMeta((prev) => ({
        ...prev,
        lastGeneratedSession: currentSessionId
      }));
    } catch (err) {
      setGenerateError(err.message || 'Could not generate a lesson.');
    } finally {
      setGenerating(false);
    }
  }, [lessonKind, theme, difficulty, currentSessionId]);

  useEffect(() => {
    if (!initLoaded) return;

    const active = getStoredActiveLesson();
    if (
      active &&
      active.sessionId === currentSessionId &&
      Array.isArray(active.lesson) &&
      active.lesson.length > 0 &&
      active.stepIndex < active.lesson.length
    ) {
      return;
    }

    const alreadyGeneratedThisSession = meta.lastGeneratedSession === currentSessionId;
    const alreadyCompletedThisSession = meta.lastCompletedSession === currentSessionId;

    if (!alreadyGeneratedThisSession && !alreadyCompletedThisSession) {
      generateLesson();
    }
  }, [initLoaded, currentSessionId, meta.lastGeneratedSession, meta.lastCompletedSession, generateLesson]);

  const sampleJson = `{
  "title": "Morning Arabic Lesson",
  "source_phrases": [
    {
      "id": 1,
      "track": "Reading Arabic",
      "category": "Culture",
      "level": "B1",
      "arabic": "تَحْمِلُ الْمُدُنُ الْقَدِيمَةُ ذَاكِرَةً طَوِيلَةً",
      "transliteration": "Taḥmilu al-mudunu al-qadīma dhākiratan ṭawīla",
      "english": "Old cities carry a long memory",
      "notes": "A reflective cultural sentence."
    }
  ]
}`;

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
            <Button secondary onClick={() => speak(current.arabic)}>
              <Volume2 size={16} /> Play Arabic
            </Button>
          </div>

          <div className="stack">
            {voiceSupported && (
              <div className="subpanel">
                <div className="panel-title">Say the Arabic aloud</div>

                <div className="button-grid-2">
                  <Button secondary onClick={isListening ? stopVoicePractice : startVoicePractice}>
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />} {isListening ? 'Stop' : 'Voice practice'}
                  </Button>
                  <Button secondary onClick={() => speak(current.arabic)}>
                    <Volume2 size={16} /> Hear again
                  </Button>
                </div>

                {spokenText && <div className="muted top-gap">Heard: {spokenText}</div>}
                {voiceFeedback === 'correct' && <div className="ok-msg top-gap">Good pronunciation match.</div>}
                {voiceFeedback === 'heard' && <div className="muted top-gap">Good try. The phrase sounded a bit different.</div>}
                {voiceFeedback === 'error' && <div className="error-msg top-gap">Voice input did not work this time.</div>}
              </div>
            )}

            <Button onClick={goNext}>Continue</Button>
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
            <Button secondary onClick={() => speak(current.arabic)}>
              <Volume2 size={16} /> Play Arabic
            </Button>
          </div>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type in English"
            className="text-input"
          />

          <div className="button-grid-2">
            <Button onClick={checkTyping}>Check</Button>
            <Button secondary onClick={() => setShowAnswer(true)}>Show answer</Button>
          </div>

          {showAnswer && (
            <div className="subpanel">
              <div className="english-big">{current.english}</div>
            </div>
          )}

          {feedback === 'correct' && (
            <div className="feedback ok">
              <CheckCircle2 size={20} />
              <div>
                <strong>Correct</strong>
                <div className="muted">Nicely done.</div>
              </div>
            </div>
          )}

          {feedback === 'wrong' && (
            <div className="feedback error">
              <XCircle size={20} />
              <div>
                <strong>Not quite</strong>
                <div className="muted">Answer: {current.english}</div>
              </div>
            </div>
          )}

          <Button secondary onClick={goNext}>Next step</Button>
        </div>
      );
    }

    if (currentStep.type === 'mcq' || currentStep.type === 'listen' || currentStep.type === 'fill_blank') {
      const isListen = currentStep.type === 'listen';
      const isBlank = currentStep.type === 'fill_blank';

      return (
        <div className="space-y">
          <div className="row-between">
            <span className="pill soft">
              {isListen ? 'Listening' : isBlank ? 'Fill in the blank' : 'Choose the meaning'}
            </span>
            <span className="pill">{current.level}</span>
          </div>

          <div className="lesson-center">
            {isListen ? (
              <>
                <div className="muted">Tap to hear the Arabic, then choose the meaning.</div>
                <Button secondary onClick={() => speak(current.arabic)}>
                  <Volume2 size={16} /> Play Arabic
                </Button>
              </>
            ) : isBlank ? (
              <>
                <div className="arabic-big" dir="rtl">{currentStep.promptArabic}</div>
                <div className="muted">Choose the missing Arabic word.</div>
              </>
            ) : (
              <>
                <div className="arabic-big" dir="rtl">{current.arabic}</div>
                <div className="translit">{current.transliteration}</div>
              </>
            )}
          </div>

          <div className="stack">
            {(isBlank ? currentStep.options : currentStep.choices).map((choice) => (
              <button key={choice} className="choice-button" onClick={() => checkChoice(choice)}>
                {choice}
              </button>
            ))}
          </div>

          {feedback === 'correct' && (
            <div className="feedback ok">
              <CheckCircle2 size={20} />
              <div>
                <strong>Correct</strong>
                <div className="muted">That is right.</div>
              </div>
            </div>
          )}

          {feedback === 'wrong' && (
            <div className="feedback error">
              <XCircle size={20} />
              <div>
                <strong>Not quite</strong>
                <div className="muted">
                  {isBlank ? `Correct answer: ${currentStep.blankAnswer}` : `Correct answer: ${current.english}`}
                </div>
              </div>
            </div>
          )}

          <Button secondary onClick={goNext}>Next step</Button>
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
              <p>A calm Arabic learning companion.</p>
            </div>
          </div>

          <div className="stats-grid stats-grid-4">
            <div className="mini-card"><span>Mastered</span><strong>{masteredCount}</strong></div>
            <div className="mini-card"><span>Daily lessons</span><strong>{dailyGoal}</strong></div>
            <div className="mini-card"><span>Library size</span><strong>{PHRASES.length}</strong></div>
            <div className="mini-card"><span>Lesson no.</span><strong>{lessonNumber}</strong></div>
          </div>

          <div className="progress-block">
            <div className="row-between"><span>Overall progress</span><span>{overallProgress}%</span></div>
            <div className="progress-bar"><div style={{ width: `${overallProgress}%` }} /></div>
          </div>

          <div className="progress-card">
            <div className="row-between"><span>{currentSessionLabel} lesson</span><span>{lessonProgress}%</span></div>
            <div className="progress-bar thin"><div style={{ width: `${lessonProgress}%` }} /></div>
          </div>
        </div>

        <div className="card">
          <div className="row title-row"><Sparkles size={16} /> <strong>Generate lesson</strong></div>
          <p className="muted">A fresh lesson is created once per morning session and once per evening session.</p>

          <div className="button-grid-2 top-gap">
            <select className="text-input" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="mixed">Mixed</option>
              <option value="daily life">Daily life</option>
              <option value="travel">Travel</option>
              <option value="reading">Reading</option>
              <option value="history and culture">History and culture</option>
              <option value="proverbs and idioms">Proverbs and idioms</option>
            </select>

            <select className="text-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="A2/B1/B2">A2/B1/B2</option>
              <option value="B1 focused">B1 focused</option>
              <option value="B1/B2">B1/B2</option>
            </select>
          </div>

          <div className="button-grid-2 top-gap">
            <Button onClick={generateLesson} disabled={generating}>
              {generating ? 'Generating...' : <><Sparkles size={16} /> Generate lesson</>}
            </Button>
            <Button secondary onClick={rebuildLesson}>Use built-in lesson</Button>
          </div>

          {generateError ? <div className="error-msg top-gap">{generateError}</div> : null}
        </div>

        <div className="card">
          <div className="tabs-grid">
            {[
              ['lesson', <BookOpen size={16} />, 'Lesson'],
              ['listen', <Ear size={16} />, 'Listen'],
              ['phrasebook', <ScrollText size={16} />, 'Phrases'],
              ['review', <Star size={16} />, 'Review']
            ].map(([value, icon, label]) => (
              <button
                key={value}
                className={`tab-button ${mode === value ? 'active' : ''}`}
                onClick={() => setMode(value)}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="chip-row top-gap">
            {tracks.map((t) => (
              <button
                key={t}
                className={`chip ${track === t ? 'chip-active' : ''}`}
                onClick={() => setTrack(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="button-grid-2 top-gap">
            <button
              className="toggle-card"
              onClick={() => setLessonKind((v) => (v === 'morning' ? 'evening' : 'morning'))}
            >
              <Brain size={16} /> {lessonKind === 'morning' ? 'Morning lesson' : 'Evening lesson'}
            </button>

            <button
              className={`toggle-card ${adaptiveMode ? 'toggle-active' : ''}`}
              onClick={() => setAdaptiveMode((v) => !v)}
            >
              <TrendingUp size={16} /> Adaptive {adaptiveMode ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {mode === 'lesson' && (
          <div className="card">
            {noLessonLoaded ? (
              <div className="lesson-center">
                <div className="title-big">
                  {meta.lastCompletedSession === currentSessionId
                    ? `${currentSessionLabel} session complete`
                    : 'Lesson ready soon'}
                </div>
                <div className="muted">
                  {meta.lastCompletedSession === currentSessionId
                    ? 'You have already finished this session. A new lesson will appear in the next session.'
                    : generating
                      ? 'Generating your lesson...'
                      : 'Tap Generate lesson to start.'}
                </div>
                <div className="stack top-gap">
                  <Button onClick={generateLesson} disabled={generating}>
                    {generating ? 'Generating...' : 'Generate lesson'}
                  </Button>
                </div>
              </div>
            ) : lessonComplete ? (
              <div className="lesson-center">
                <div className="title-big">Lesson {lessonNumber - 1} complete 🎉</div>
                <div className="muted">A clean stopping point, just like Duolingo.</div>
                <div className="stack top-gap">
                  <Button onClick={generateLesson}>Generate next lesson</Button>
                  <Button secondary onClick={() => setMode('review')}>Go to review</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-between">
                  <span className="pill soft">Lesson {lessonNumber} · Step {stepIndex + 1} / {lesson.length}</span>
                  <span className="muted">{externalLessonInfo ? externalLessonInfo.source : current.track}</span>
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
              {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track))
                .slice(0, 14)
                .map((item) => (
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
            <p className="muted">Browse daily Arabic, travel, reading, history, poetry, and culture.</p>
            <div className="stack top-gap">
              {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).map((item) => (
                <div key={item.id} className="phrase-card">
                  <div className="row-between">
                    <span className="pill soft">{item.category}</span>
                    <div className="row">
                      <span className="pill">{item.level}</span>
                      <button className="icon-only" onClick={() => speak(item.arabic)}>
                        <Volume2 size={16} />
                      </button>
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
            <h2>Review & accomplishments</h2>
            <p className="muted">Track lessons completed and keep weaker items moving in rotation.</p>

            <div className="stats-grid stats-grid-3 top-gap">
              <div className="mini-card"><span>Lessons done</span><strong>{meta.lessonsCompleted}</strong></div>
              <div className="mini-card"><span>Current streak</span><strong>{Math.max(1, Math.min(meta.lessonsCompleted, 7))}</strong></div>
              <div className="mini-card"><span>Phrase bank</span><strong>{PHRASES.length}</strong></div>
            </div>

            <div className="subpanel top-gap">
              <div className="row title-row"><Trophy size={16} /> <strong>Accomplishments</strong></div>
              {meta.accomplishments?.length ? (
                <ul className="feature-list">
                  {meta.accomplishments.map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              ) : (
                <div className="muted">Complete a few lessons to start unlocking accomplishments.</div>
              )}
            </div>

            <div className="stack top-gap">
              {categoryStats.map((row) => (
                <div key={row.cat} className="phrase-card">
                  <div className="row-between">
                    <strong>{row.cat}</strong>
                    <span className="muted">{row.mastered}/{row.total}</span>
                  </div>
                  <div className="progress-bar thin top-gap">
                    <div style={{ width: `${(row.mastered / row.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="stack top-gap">
              <Button onClick={weakPractice}><Shuffle size={16} /> Practice weak phrases</Button>
              <Button secondary onClick={resetAll}><RotateCcw size={16} /> Reset progress</Button>
            </div>

            <div className="subpanel top-gap">
              Correct answers logged: <strong>{correctToday}</strong><br />
              Voice practice appears only on browsers that expose speech recognition.<br />
              Progress is saved in the phone browser using local storage.
            </div>
          </div>
        )}

        <div className="card">
          <div className="row title-row"><Languages size={16} /> <strong>What this version now does</strong></div>
          <ul className="feature-list">
            <li>Generates a lesson with one tap through a server-side API call</li>
            <li>Restores the exact step if the page refreshes by mistake</li>
            <li>Creates one morning lesson and one evening lesson per day</li>
            <li>Numbers each lesson and records lessons completed</li>
            <li>Keeps phrasebook, review, listening, and voice practice in one app</li>
          </ul>
        </div>

        {/* Manual lesson import (hidden at bottom) */}
        <div className="card">
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
              Manual lesson import
            </summary>

            <div className="top-gap">
              <p className="muted">
                Paste JSON from your Arabic Lesson Factory here if you want to override the generated lesson.
              </p>

              <textarea
                className="json-box"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={sampleJson}
              />

              <div className="button-grid-2 top-gap">
                <Button onClick={loadImportedLesson}>
                  <Download size={16} /> Load lesson
                </Button>
                <Button secondary onClick={() => setImportText(sampleJson)}>
                  Paste sample
                </Button>
              </div>

              {importError ? <div className="error-msg top-gap">{importError}</div> : null}

              {externalLessonInfo ? (
                <div className="ok-msg top-gap">
                  Loaded {externalLessonInfo.count} source phrases from {externalLessonInfo.source}.
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2, CheckCircle2, XCircle, RotateCcw, BookOpen, Ear, Shuffle, Star,
  PlayCircle, ScrollText, Languages, Mic, MicOff, TrendingUp, Brain,
  Download, Upload, Trophy, Sparkles
} from 'lucide-react';
import { PHRASES } from './phrases';

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/[؟?!.,']/g, '').replace(/\s+/g, ' ').trim();
}
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function getStoredProgress() { try { return JSON.parse(localStorage.getItem('arabic-dad-progress-v5') || '{}'); } catch { return {}; } }
function saveStoredProgress(progress) { try { localStorage.setItem('arabic-dad-progress-v5', JSON.stringify(progress)); } catch {} }
function getStoredMeta() {
  try { return JSON.parse(localStorage.getItem('arabic-dad-meta-v5') || '{"lessonsCompleted":0,"lastLessonNumber":0,"accomplishments":[]}'); }
  catch { return { lessonsCompleted: 0, lastLessonNumber: 0, accomplishments: [] }; }
}
function saveStoredMeta(meta) { try { localStorage.setItem('arabic-dad-meta-v5', JSON.stringify(meta)); } catch {} }
function getItemStats(progress, id) { return progress[id] || { correct: 0, wrong: 0, mastered: false, spoken: 0 }; }
function browserHasSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function buildAdaptivePool(phrases, progress, track) {
  const filtered = track === 'All Tracks' ? phrases : phrases.filter((p) => p.track === track);
  const weak = filtered.filter((p) => { const s = getItemStats(progress, p.id); return s.wrong >= s.correct || (!s.mastered && s.correct <= 1); });
  const fresh = filtered.filter((p) => { const s = getItemStats(progress, p.id); return s.correct === 0 && s.wrong === 0; });
  const strong = filtered.filter((p) => getItemStats(progress, p.id).mastered);
  const steady = filtered.filter((p) => !weak.includes(p) && !fresh.includes(p) && !strong.includes(p));
  const mixed = [...shuffle(weak).slice(0, 8), ...shuffle(fresh).slice(0, 8), ...shuffle(steady).slice(0, 8), ...shuffle(strong).slice(0, 4)];
  return mixed.length ? mixed : shuffle(filtered);
}
function generateTasksFromPhrases(base, lessonKind = 'morning') {
  if (!base.length) return [];
  const tasks = [];
  const selected = base.slice(0, lessonKind === 'morning' ? 8 : 7);
  const others = shuffle(selected);
  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const alt1 = others[(i + 1) % others.length] || item;
    const alt2 = others[(i + 2) % others.length] || item;
    if (lessonKind === 'morning' || i < 3) tasks.push({ type: 'learn', item });
    tasks.push({ type: 'mcq', item, choices: shuffle([item.english, alt1.english, alt2.english]).slice(0, 3) });
    tasks.push({ type: 'typing', item });
    tasks.push({ type: 'listen', item, choices: shuffle([item.english, alt1.english, alt2.english]).slice(0, 3) });
    const words = item.arabic.split(' ');
    if (words.length > 1) {
      const missingIndex = Math.min(1, words.length - 1);
      const answer = words[missingIndex];
      const promptWords = [...words];
      promptWords[missingIndex] = '_____';
      tasks.push({
        type: 'fill_blank',
        item,
        promptArabic: promptWords.join(' '),
        blankAnswer: answer,
        options: shuffle([answer, alt1.arabic.split(' ')[0] || answer, alt2.arabic.split(' ')[0] || answer]).slice(0, 3)
      });
    }
    tasks.push({ type: 'review', item });
  }
  return tasks.slice(0, lessonKind === 'morning' ? 40 : 32);
}
function buildLessonItems(pool, lessonKind = 'morning') {
  return generateTasksFromPhrases(shuffle(pool).slice(0, lessonKind === 'morning' ? 8 : 7), lessonKind);
}
function sanitizeImportedPhrase(p, idx) {
  return {
    id: p.id ?? (100000 + idx),
    track: p.track || 'Imported Lesson',
    category: p.category || 'Generated',
    level: p.level || 'B1',
    arabic: p.arabic || '',
    transliteration: p.transliteration || '',
    english: p.english || '',
    answer: (p.answer || p.english || '').toLowerCase(),
    notes: p.notes || 'Imported lesson phrase.'
  };
}
function importLessonJson(rawText) {
  const parsed = JSON.parse(rawText);
  const sourcePhrases = Array.isArray(parsed) ? parsed : (parsed.source_phrases || parsed.phrases || []);
  return sourcePhrases.map(sanitizeImportedPhrase).filter(p => p.arabic && p.english);
}
function Button({ children, onClick, secondary = false, disabled = false }) {
  return <button className={`button ${secondary ? 'button-secondary' : 'button-primary'}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export default function App() {
  const [mode, setMode] = useState('lesson');
  const [track, setTrack] = useState('All Tracks');
  const [lessonKind, setLessonKind] = useState('morning');
  const [progress, setProgress] = useState({});
  const [meta, setMeta] = useState({ lessonsCompleted: 0, lastLessonNumber: 0, accomplishments: [] });
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
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [externalLessonInfo, setExternalLessonInfo] = useState(null);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [theme, setTheme] = useState('mixed');
  const [difficulty, setDifficulty] = useState('A2/B1/B2');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const dailyGoal = 2;

  useEffect(() => {
    setProgress(getStoredProgress());
    const storedMeta = getStoredMeta();
    setMeta(storedMeta);
    setLessonNumber((storedMeta.lastLessonNumber || 0) + 1);
    setVoiceSupported(browserHasSpeechRecognition());
  }, []);
  useEffect(() => { saveStoredProgress(progress); }, [progress]);
  useEffect(() => { saveStoredMeta(meta); }, [meta]);

  const tracks = ['All Tracks', ...new Set(PHRASES.map((p) => p.track))];

  const rebuildLesson = useCallback(() => {
    const pool = adaptiveMode ? buildAdaptivePool(PHRASES, progress, track) : shuffle(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track));
    setExternalLessonInfo(null);
    setLesson(buildLessonItems(pool, lessonKind));
    setStepIndex(0); setInput(''); setFeedback(null); setShowAnswer(false); setSpokenText(''); setVoiceFeedback(null); setIsListening(false); setImportError(''); setGenerateError('');
  }, [adaptiveMode, progress, track, lessonKind]);
  useEffect(() => { rebuildLesson(); }, [rebuildLesson]);

  const currentStep = lesson[stepIndex] || null;
  const current = currentStep?.item || PHRASES[0];
  const lessonComplete = lesson.length > 0 && stepIndex >= lesson.length;
  const masteredCount = useMemo(() => Object.values(progress).filter((p) => p?.mastered).length, [progress]);
  const correctToday = useMemo(() => Object.values(progress).reduce((acc, p) => acc + (p?.correct || 0), 0), [progress]);
  const overallProgress = Math.min(100, Math.round((masteredCount / PHRASES.length) * 100));
  const lessonProgress = lesson.length ? Math.round((Math.min(stepIndex, lesson.length) / lesson.length) * 100) : 0;
  const categoryStats = useMemo(() => {
    const cats = [...new Set(PHRASES.map((p) => p.category))];
    return cats.slice(0, 12).map((cat) => {
      const items = PHRASES.filter((p) => p.category === cat);
      const mastered = items.filter((p) => progress[p.id]?.mastered).length;
      return { cat, total: items.length, mastered };
    });
  }, [progress]);

  const speak = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA'; utter.rate = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };
  const markProgress = (isCorrect, spoken = false) => {
    setProgress((prev) => {
      const prevItem = getItemStats(prev, current.id);
      const updated = { ...prevItem, correct: prevItem.correct + (isCorrect ? 1 : 0), wrong: prevItem.wrong + (isCorrect ? 0 : 1), spoken: prevItem.spoken + (spoken ? 1 : 0) };
      updated.mastered = updated.correct >= 3 && updated.correct > updated.wrong;
      return { ...prev, [current.id]: updated };
    });
  };
  const registerLessonCompletion = () => {
    setMeta((prev) => {
      const nextCompleted = prev.lessonsCompleted + 1;
      const nextAcc = [...(prev.accomplishments || [])];
      if (nextCompleted === 1 && !nextAcc.includes('Completed Lesson 1')) nextAcc.push('Completed Lesson 1');
      if (nextCompleted === 7 && !nextAcc.includes('Completed 7 lessons')) nextAcc.push('Completed 7 lessons');
      if (nextCompleted === 30 && !nextAcc.includes('Completed 30 lessons')) nextAcc.push('Completed 30 lessons');
      if (masteredCount >= 25 && !nextAcc.includes('Mastered 25 phrases')) nextAcc.push('Mastered 25 phrases');
      return { lessonsCompleted: nextCompleted, lastLessonNumber: lessonNumber, accomplishments: nextAcc };
    });
    setLessonNumber((n) => n + 1);
  };
  const goNext = () => {
    setInput(''); setFeedback(null); setShowAnswer(false); setSpokenText(''); setVoiceFeedback(null);
    setStepIndex((s) => { const next = s + 1; if (next >= lesson.length) registerLessonCompletion(); return next; });
    setTimeout(() => inputRef.current?.focus(), 80);
  };
  const checkTyping = () => {
    const ok = normalizeText(input) === normalizeText(current.answer) || normalizeText(input) === normalizeText(current.english);
    setFeedback(ok ? 'correct' : 'wrong'); markProgress(ok);
  };
  const checkChoice = (choice) => {
    const ok = normalizeText(choice) === normalizeText(current.english) || normalizeText(choice) === normalizeText(currentStep.blankAnswer);
    setFeedback(ok ? 'correct' : 'wrong'); markProgress(ok);
  };
  const startVoicePractice = () => {
    if (!voiceSupported || typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const recognition = new SR(); recognition.lang = 'ar-SA'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => { setIsListening(true); setSpokenText(''); setVoiceFeedback(null); };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setSpokenText(transcript);
      const ok = normalizeText(transcript) === normalizeText(current.arabic);
      setVoiceFeedback(ok ? 'correct' : 'heard'); markProgress(ok, true);
    };
    recognition.onerror = () => { setVoiceFeedback('error'); setIsListening(false); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition; recognition.start();
  };
  const stopVoicePractice = () => { recognitionRef.current?.stop?.(); setIsListening(false); };
  const resetAll = () => {
    localStorage.removeItem('arabic-dad-progress-v5'); localStorage.removeItem('arabic-dad-meta-v5');
    setProgress({}); setMeta({ lessonsCompleted: 0, lastLessonNumber: 0, accomplishments: [] }); setLessonNumber(1); rebuildLesson();
  };
  const weakPractice = () => {
    const weakPool = PHRASES.filter((p) => { const s = getItemStats(progress, p.id); return s.wrong >= s.correct || !s.mastered; });
    setExternalLessonInfo(null); setLesson(generateTasksFromPhrases(shuffle(weakPool.length ? weakPool : PHRASES).slice(0, 8), 'evening'));
    setStepIndex(0); setInput(''); setFeedback(null); setShowAnswer(false);
  };
  const loadImportedLesson = () => {
    try {
      const phrases = importLessonJson(importText);
      if (!phrases.length) throw new Error('No usable source phrases found in the JSON.');
      setLesson(generateTasksFromPhrases(phrases, lessonKind));
      setExternalLessonInfo({ count: phrases.length, source: 'Imported lesson' });
      setStepIndex(0); setInput(''); setFeedback(null); setShowAnswer(false); setImportError(''); setGenerateError(''); setMode('lesson');
    } catch (err) { setImportError(err.message || 'Could not load the lesson JSON.'); }
  };
  const generateLesson = async () => {
    try {
      setGenerating(true);
      setGenerateError('');
      setImportError('');
      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_kind: lessonKind, theme, difficulty, task_target: lessonKind === 'morning' ? 40 : 32 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lesson generation failed.');
      const sourcePhrases = (data.source_phrases || data.phrases || []).map(sanitizeImportedPhrase).filter(p => p.arabic && p.english);
      if (!sourcePhrases.length) throw new Error('No lesson phrases were returned.');
      setLesson(generateTasksFromPhrases(sourcePhrases, lessonKind));
      setExternalLessonInfo({ count: sourcePhrases.length, source: 'API lesson' });
      setImportText(JSON.stringify(data, null, 2));
      setStepIndex(0); setInput(''); setFeedback(null); setShowAnswer(false); setMode('lesson');
    } catch (err) {
      setGenerateError(err.message || 'Could not generate a lesson.');
    } finally {
      setGenerating(false);
    }
  };

  const sampleJson = `{\n  "title": "Morning Arabic Lesson",\n  "source_phrases": [\n    {\n      "id": 1,\n      "track": "Reading Arabic",\n      "category": "Culture",\n      "level": "B1",\n      "arabic": "تَحْمِلُ الْمُدُنُ الْقَدِيمَةُ ذَاكِرَةً طَوِيلَةً",\n      "transliteration": "Taḥmilu al-mudunu al-qadīma dhākiratan ṭawīla",\n      "english": "Old cities carry a long memory",\n      "notes": "A reflective cultural sentence."\n    }\n  ]\n}`;

  const renderLessonStep = () => {
    if (!currentStep) return null;
    if (currentStep.type === 'learn' || currentStep.type === 'review' || currentStep.type === 'reading') {
      return <div className="space-y">
        <div className="row-between"><span className="pill soft">{current.category}</span><span className="pill">{current.level}</span></div>
        <div className="lesson-center">
          <div className="arabic-big" dir="rtl">{current.arabic}</div>
          <div className="translit">{current.transliteration}</div>
          <div className="english-big">{current.english}</div>
          <div className="muted">{current.notes}</div>
        </div>
        <div className="center"><Button secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Play Arabic</Button></div>
        <div className="stack">
          {voiceSupported && <div className="subpanel">
            <div className="panel-title">Say the Arabic aloud</div>
            <div className="button-grid-2">
              <Button secondary onClick={isListening ? stopVoicePractice : startVoicePractice}>{isListening ? <MicOff size={16} /> : <Mic size={16} />} {isListening ? 'Stop' : 'Voice practice'}</Button>
              <Button secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Hear again</Button>
            </div>
            {spokenText && <div className="muted top-gap">Heard: {spokenText}</div>}
            {voiceFeedback === 'correct' && <div className="ok-msg top-gap">Good pronunciation match.</div>}
            {voiceFeedback === 'heard' && <div className="muted top-gap">Good try. The phrase sounded a bit different.</div>}
            {voiceFeedback === 'error' && <div className="error-msg top-gap">Voice input did not work this time.</div>}
          </div>}
          <Button onClick={goNext}>Continue</Button>
        </div>
      </div>;
    }
    if (currentStep.type === 'typing') {
      return <div className="space-y">
        <div className="row-between"><span className="pill soft">Typing</span><span className="pill">{current.level}</span></div>
        <div className="lesson-center">
          <div className="arabic-big" dir="rtl">{current.arabic}</div>
          <div className="translit">{current.transliteration}</div>
          <div className="muted">Type the meaning in English</div>
        </div>
        <div className="center"><Button secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Play Arabic</Button></div>
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type in English" className="text-input" />
        <div className="button-grid-2"><Button onClick={checkTyping}>Check</Button><Button secondary onClick={() => setShowAnswer(true)}>Show answer</Button></div>
        {showAnswer && <div className="subpanel"><div className="english-big">{current.english}</div></div>}
        {feedback === 'correct' && <div className="feedback ok"><CheckCircle2 size={20} /> <div><strong>Correct</strong><div className="muted">Nicely done.</div></div></div>}
        {feedback === 'wrong' && <div className="feedback error"><XCircle size={20} /> <div><strong>Not quite</strong><div className="muted">Answer: {current.english}</div></div></div>}
        <Button secondary onClick={goNext}>Next step</Button>
      </div>;
    }
    if (currentStep.type === 'mcq' || currentStep.type === 'listen' || currentStep.type === 'fill_blank') {
      const isListen = currentStep.type === 'listen';
      const isBlank = currentStep.type === 'fill_blank';
      return <div className="space-y">
        <div className="row-between"><span className="pill soft">{isListen ? 'Listening' : isBlank ? 'Fill in the blank' : 'Choose the meaning'}</span><span className="pill">{current.level}</span></div>
        <div className="lesson-center">
          {isListen ? <>
            <div className="muted">Tap to hear the Arabic, then choose the meaning.</div>
            <Button secondary onClick={() => speak(current.arabic)}><Volume2 size={16} /> Play Arabic</Button>
          </> : isBlank ? <>
            <div className="arabic-big" dir="rtl">{currentStep.promptArabic}</div>
            <div className="muted">Choose the missing Arabic word.</div>
          </> : <>
            <div className="arabic-big" dir="rtl">{current.arabic}</div>
            <div className="translit">{current.transliteration}</div>
          </>}
        </div>
        <div className="stack">
          {(isBlank ? currentStep.options : currentStep.choices).map((choice) => (
            <button key={choice} className="choice-button" onClick={() => checkChoice(choice)}>{choice}</button>
          ))}
        </div>
        {feedback === 'correct' && <div className="feedback ok"><CheckCircle2 size={20} /> <div><strong>Correct</strong><div className="muted">That is right.</div></div></div>}
        {feedback === 'wrong' && <div className="feedback error"><XCircle size={20} /> <div><strong>Not quite</strong><div className="muted">{isBlank ? `Correct answer: ${currentStep.blankAnswer}` : `Correct answer: ${current.english}`}</div></div></div>}
        <Button secondary onClick={goNext}>Next step</Button>
      </div>;
    }
    return null;
  };

  return <div className="app-shell">
    <div className="app-container">
      <div className="card">
        <div className="card-header"><div><h1>Arabic Companion</h1><p>A calm Arabic learning companion.</p></div></div>
        <div className="stats-grid stats-grid-4">
          <div className="mini-card"><span>Mastered</span><strong>{masteredCount}</strong></div>
          <div className="mini-card"><span>Daily lessons</span><strong>{dailyGoal}</strong></div>
          <div className="mini-card"><span>Library size</span><strong>{PHRASES.length}</strong></div>
          <div className="mini-card"><span>Lesson no.</span><strong>{lessonNumber}</strong></div>
        </div>
        <div className="progress-block"><div className="row-between"><span>Overall progress</span><span>{overallProgress}%</span></div><div className="progress-bar"><div style={{ width: `${overallProgress}%` }} /></div></div>
        <div className="progress-card"><div className="row-between"><span>Current lesson</span><span>{lessonProgress}%</span></div><div className="progress-bar thin"><div style={{ width: `${lessonProgress}%` }} /></div></div>
      </div>

      <div className="card">
        <div className="row title-row"><Sparkles size={16} /> <strong>Generate lesson</strong></div>
        <p className="muted">Tap once and the app will create a full lesson using the permanent lesson prompt on the server.</p>
        <div className="button-grid-2 top-gap">
          <select className="text-input" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="mixed">Mixed</option>
            <option value="daily life">Daily life</option>
            <option value="travel">Travel</option>
            <option value="reading">Reading</option>
            <option value="history and culture">History and culture</option>
            <option value="proverbs and idioms">Proverbs and idioms</option>
          </select>
          <select className="text-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="A2/B1/B2">A2/B1/B2</option>
            <option value="B1 focused">B1 focused</option>
            <option value="B1/B2">B1/B2</option>
          </select>
        </div>
        <div className="button-grid-2 top-gap">
          <Button onClick={generateLesson} disabled={generating}>{generating ? 'Generating...' : <><Sparkles size={16} /> Generate lesson</>}</Button>
          <Button secondary onClick={rebuildLesson}>Use built-in lesson</Button>
        </div>
        {generateError ? <div className="error-msg top-gap">{generateError}</div> : null}
      </div>

      <div className="card">
        <div className="tabs-grid">
          {[
            ['lesson', <BookOpen size={16} />, 'Lesson'],
            ['listen', <Ear size={16} />, 'Listen'],
            ['phrasebook', <ScrollText size={16} />, 'Phrases'],
            ['review', <Star size={16} />, 'Review'],
          ].map(([value, icon, label]) => (
            <button key={value} className={`tab-button ${mode === value ? 'active' : ''}`} onClick={() => setMode(value)}>{icon} {label}</button>
          ))}
        </div>
        <div className="chip-row top-gap">
          {tracks.map((t) => <button key={t} className={`chip ${track === t ? 'chip-active' : ''}`} onClick={() => setTrack(t)}>{t}</button>)}
        </div>
        <div className="button-grid-2 top-gap">
          <button className="toggle-card" onClick={() => setLessonKind((v) => (v === 'morning' ? 'evening' : 'morning'))}><Brain size={16} /> {lessonKind === 'morning' ? 'Morning lesson' : 'Evening lesson'}</button>
          <button className={`toggle-card ${adaptiveMode ? 'toggle-active' : ''}`} onClick={() => setAdaptiveMode((v) => !v)}><TrendingUp size={16} /> Adaptive {adaptiveMode ? 'On' : 'Off'}</button>
        </div>
      </div>

      {mode === 'lesson' && <div className="card">
        {lessonComplete ? <div className="lesson-center">
          <div className="title-big">Lesson {lessonNumber - 1} complete 🎉</div>
          <div className="muted">A clean stopping point, just like Duolingo.</div>
          <div className="stack top-gap"><Button onClick={generateLesson}>Generate next lesson</Button><Button secondary onClick={() => setMode('review')}>Go to review</Button></div>
        </div> : <>
          <div className="row-between"><span className="pill soft">Lesson {lessonNumber} · Step {stepIndex + 1} / {lesson.length}</span><span className="muted">{externalLessonInfo ? externalLessonInfo.source : current.track}</span></div>
          <div className="top-gap">{renderLessonStep()}</div>
        </>}
      </div>}

      {mode === 'listen' && <div className="card">
        <h2>Listening practice</h2><p className="muted">Tap a phrase to hear it in Arabic.</p>
        <div className="stack top-gap">
          {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).slice(0, 14).map((item) => (
            <button key={item.id} className="list-card" onClick={() => speak(item.arabic)}>
              <div className="row-between"><div><div className="arabic-mid" dir="rtl">{item.arabic}</div><div className="translit small">{item.transliteration}</div><div className="muted">{item.english}</div></div><PlayCircle size={22} /></div>
            </button>
          ))}
        </div>
      </div>}

      {mode === 'phrasebook' && <div className="card">
        <h2>Phrasebook & reading bank</h2><p className="muted">Browse daily Arabic, travel, reading, history, poetry, and culture.</p>
        <div className="stack top-gap">
          {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).map((item) => (
            <div key={item.id} className="phrase-card">
              <div className="row-between"><span className="pill soft">{item.category}</span><div className="row"><span className="pill">{item.level}</span><button className="icon-only" onClick={() => speak(item.arabic)}><Volume2 size={16} /></button></div></div>
              <div className="arabic-mid top-gap" dir="rtl">{item.arabic}</div><div className="translit small">{item.transliteration}</div><div className="english-mid">{item.english}</div><div className="muted">{item.notes}</div>
            </div>
          ))}
        </div>
      </div>}

      {mode === 'review' && <div className="card">
        <h2>Review & accomplishments</h2><p className="muted">Track lessons completed and keep weaker items moving in rotation.</p>
        <div className="stats-grid stats-grid-3 top-gap">
          <div className="mini-card"><span>Lessons done</span><strong>{meta.lessonsCompleted}</strong></div>
          <div className="mini-card"><span>Current streak</span><strong>{Math.max(1, Math.min(meta.lessonsCompleted, 7))}</strong></div>
          <div className="mini-card"><span>Phrase bank</span><strong>{PHRASES.length}</strong></div>
        </div>
        <div className="subpanel top-gap">
          <div className="row title-row"><Trophy size={16} /> <strong>Accomplishments</strong></div>
          {meta.accomplishments?.length ? <ul className="feature-list">{meta.accomplishments.map((item, idx) => <li key={idx}>{item}</li>)}</ul> : <div className="muted">Complete a few lessons to start unlocking accomplishments.</div>}
        </div>
        <div className="stack top-gap">
          {categoryStats.map((row) => <div key={row.cat} className="phrase-card"><div className="row-between"><strong>{row.cat}</strong><span className="muted">{row.mastered}/{row.total}</span></div><div className="progress-bar thin top-gap"><div style={{ width: `${(row.mastered / row.total) * 100}%` }} /></div></div>)}
        </div>
        <div className="stack top-gap"><Button onClick={weakPractice}><Shuffle size={16} /> Practice weak phrases</Button><Button secondary onClick={resetAll}><RotateCcw size={16} /> Reset progress</Button></div>
        <div className="subpanel top-gap">Correct answers logged: <strong>{correctToday}</strong><br />Voice practice appears only on browsers that expose speech recognition.<br />Progress is saved in the phone browser using local storage.</div>
      </div>}

      <div className="card">
        <div className="row title-row"><Languages size={16} /> <strong>What this version now does</strong></div>
        <ul className="feature-list">
          <li>Generates a lesson with one tap through a server-side API call</li>
          <li>Keeps the permanent lesson prompt on the server, not in the browser</li>
          <li>Still allows manual JSON paste as a fallback</li>
          <li>Numbers each lesson and records lessons completed</li>
          <li>Keeps phrasebook, review, listening, and voice practice in one app</li>
        </ul>
      </div>

      {/* Manual lesson import (hidden at bottom) */}
<div className="card">
  <details>
    <summary style={{ cursor: "pointer", fontWeight: "600" }}>
      Manual lesson import
    </summary>

    <div className="top-gap">
      <p className="muted">
        Paste JSON from your Arabic Lesson Factory here if you want to override the generated lesson.
      </p>

      <textarea
        className="json-box"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={sampleJson}
      />

      <div className="button-grid-2 top-gap">
        <Button onClick={loadImportedLesson}>
          <Download size={16} /> Load lesson
        </Button>
        <Button secondary onClick={() => setImportText(sampleJson)}>
          Paste sample
        </Button>
      </div>

      {importError ? (
        <div className="error-msg top-gap">{importError}</div>
      ) : null}

      {externalLessonInfo ? (
        <div className="ok-msg top-gap">
          Loaded {externalLessonInfo.count} source phrases from {externalLessonInfo.source}.
        </div>
      ) : null}
    </div>
  </details>
</div>
      
    </div>
  </div>;
}
