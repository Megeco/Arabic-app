import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Ear,
  Shuffle,
  Star,
  PlayCircle,
  Newspaper,
  ScrollText,
  Languages,
  Mic,
  MicOff,
  TrendingUp,
  Brain,
} from 'lucide-react'

const PHRASES = [
  { id: 1, track: 'Everyday Arabic', category: 'Greetings', level: 'A1', arabic: 'السَّلَامُ عَلَيْكُمْ', transliteration: 'As-salāmu ʿalaykum', english: 'Peace be upon you', answer: 'peace be upon you', notes: 'A very common greeting.' },
  { id: 2, track: 'Everyday Arabic', category: 'Greetings', level: 'A1', arabic: 'صَبَاحُ الْخَيْرِ', transliteration: 'Ṣabāḥu al-khayr', english: 'Good morning', answer: 'good morning', notes: 'Used in daily conversation.' },
  { id: 3, track: 'Everyday Arabic', category: 'Greetings', level: 'A1', arabic: 'مَسَاءُ الْخَيْرِ', transliteration: 'Masāʾu al-khayr', english: 'Good evening', answer: 'good evening', notes: 'A common evening greeting.' },
  { id: 4, track: 'Everyday Arabic', category: 'Basics', level: 'A1', arabic: 'كَيْفَ حَالُكَ؟', transliteration: 'Kayfa ḥāluka?', english: 'How are you?', answer: 'how are you', notes: 'A simple everyday question.' },
  { id: 5, track: 'Everyday Arabic', category: 'Basics', level: 'A1', arabic: 'أَنَا بِخَيْرٍ', transliteration: 'Anā bikhayr', english: 'I am fine', answer: 'i am fine', notes: 'A common response.' },
  { id: 6, track: 'Everyday Arabic', category: 'Daily Life', level: 'A1', arabic: 'أُرِيدُ قَهْوَةً', transliteration: 'Urīdu qahwatan', english: 'I want coffee', answer: 'i want coffee', notes: 'Useful sentence pattern: I want…' },
  { id: 7, track: 'Everyday Arabic', category: 'Daily Life', level: 'A1', arabic: 'أَيْنَ الْمَاءُ؟', transliteration: 'Ayna al-māʾ?', english: 'Where is the water?', answer: 'where is the water', notes: 'Useful for very basic nouns and question form.' },
  { id: 8, track: 'Everyday Arabic', category: 'Travel', level: 'A1', arabic: 'كَمْ هَذَا؟', transliteration: 'Kam hādhā?', english: 'How much is this?', answer: 'how much is this', notes: 'Useful for shopping and travel.' },
  { id: 9, track: 'Everyday Arabic', category: 'Travel', level: 'A1', arabic: 'أَيْنَ الْحَمَّامُ؟', transliteration: 'Ayna al-ḥammām?', english: 'Where is the bathroom?', answer: 'where is the bathroom', notes: 'Practical and memorable.' },
  { id: 10, track: 'Everyday Arabic', category: 'Family', level: 'A1', arabic: 'هَذَا أَبِي', transliteration: 'Hādhā abī', english: 'This is my father', answer: 'this is my father', notes: 'Basic demonstrative + family noun.' },
  { id: 11, track: 'Everyday Arabic', category: 'Daily Life', level: 'A1', arabic: 'أَنَا جَاهِزٌ', transliteration: 'Anā jāhiz', english: 'I am ready', answer: 'i am ready', notes: 'Useful daily phrase.' },
  { id: 12, track: 'Everyday Arabic', category: 'Home', level: 'A1', arabic: 'اِفْتَحِ الْبَابَ', transliteration: 'Iftaḥ al-bāb', english: 'Open the door', answer: 'open the door', notes: 'Useful simple command form.' },
  { id: 13, track: 'Reading Arabic', category: 'News Words', level: 'A2', arabic: 'اِقْتِصَاد', transliteration: 'Iqtiṣād', english: 'Economy', answer: 'economy', notes: 'Very common in headlines and news.' },
  { id: 14, track: 'Reading Arabic', category: 'News Words', level: 'A2', arabic: 'حُكُومَة', transliteration: 'Ḥukūma', english: 'Government', answer: 'government', notes: 'Frequent in public affairs and news writing.' },
  { id: 15, track: 'Reading Arabic', category: 'News Words', level: 'A2', arabic: 'تَارِيخ', transliteration: 'Tārīkh', english: 'History / date', answer: 'history', notes: 'Useful because your dad likes history and reading.' },
  { id: 16, track: 'Reading Arabic', category: 'Social Media', level: 'A2', arabic: 'مُهِمّ', transliteration: 'Muhimm', english: 'Important', answer: 'important', notes: 'Appears often in posts and headlines.' },
  { id: 17, track: 'Reading Arabic', category: 'Social Media', level: 'A2', arabic: 'مُمْكِن', transliteration: 'Mumkin', english: 'Possible', answer: 'possible', notes: 'Useful modern word in everyday writing.' },
  { id: 18, track: 'Reading Arabic', category: 'Social Media', level: 'A2', arabic: 'فِكْرَة جَيِّدَة', transliteration: 'Fikra jayyida', english: 'A good idea', answer: 'a good idea', notes: 'Good for reading short opinion posts.' },
  { id: 19, track: 'Culture & Proverbs', category: 'Proverbs', level: 'B1', arabic: 'الصَّبْرُ مِفْتَاحُ الْفَرَجِ', transliteration: 'Aṣ-ṣabru miftāḥu al-faraj', english: 'Patience is the key to relief', answer: 'patience is the key to relief', notes: 'A classic proverb.' },
  { id: 20, track: 'Culture & Proverbs', category: 'Proverbs', level: 'B1', arabic: 'الْوَقْتُ مِنْ ذَهَبٍ', transliteration: 'Al-waqtu min dhahab', english: 'Time is gold', answer: 'time is gold', notes: 'Short, memorable proverb.' },
  { id: 21, track: 'Culture & Proverbs', category: 'Idioms', level: 'B1', arabic: 'فِي نَفْسِ الْوَقْتِ', transliteration: 'Fī nafs al-waqt', english: 'At the same time', answer: 'at the same time', notes: 'Very useful connector in reading.' },
  { id: 22, track: 'Culture & Proverbs', category: 'Idioms', level: 'B1', arabic: 'بَيْنَ يَدَيْكَ', transliteration: 'Bayna yadayk', english: 'In front of you / before you', answer: 'in front of you', notes: 'Appears in literary and formal usage.' },
  { id: 23, track: 'Reading Arabic', category: 'Light News', level: 'B1', arabic: 'أَعْلَنَتِ الشَّرِكَةُ مَشْرُوعًا جَدِيدًا', transliteration: 'Aʿlanat ash-sharika mashrūʿan jadīdan', english: 'The company announced a new project', answer: 'the company announced a new project', notes: 'A sample headline-style sentence.' },
  { id: 24, track: 'Reading Arabic', category: 'Light News', level: 'B1', arabic: 'شَهِدَتِ الْمَدِينَةُ أَحْدَاثًا مُهِمَّةً', transliteration: 'Shahidat al-madīna aḥdāthan muhimma', english: 'The city witnessed important events', answer: 'the city witnessed important events', notes: 'A formal sentence closer to news prose.' },
]

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[؟?!.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getStoredProgress() {
  try {
    const raw = localStorage.getItem('arabic-dad-progress-v2')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStoredProgress(progress) {
  try {
    localStorage.setItem('arabic-dad-progress-v2', JSON.stringify(progress))
  } catch {}
}

function getItemStats(progress, id) {
  return progress[id] || { correct: 0, wrong: 0, mastered: false, spoken: 0 }
}

function buildAdaptivePool(phrases, progress, track) {
  const filtered = track === 'All Tracks' ? phrases : phrases.filter((p) => p.track === track)
  const weak = filtered.filter((p) => {
    const s = getItemStats(progress, p.id)
    return s.wrong >= s.correct || (!s.mastered && s.correct <= 1)
  })
  const fresh = filtered.filter((p) => {
    const s = getItemStats(progress, p.id)
    return s.correct === 0 && s.wrong === 0
  })
  const strong = filtered.filter((p) => getItemStats(progress, p.id).mastered)
  const steady = filtered.filter((p) => !weak.includes(p) && !fresh.includes(p) && !strong.includes(p))

  const mixed = [
    ...shuffle(weak).slice(0, 4),
    ...shuffle(fresh).slice(0, 3),
    ...shuffle(steady).slice(0, 3),
    ...shuffle(strong).slice(0, 2),
  ]

  return mixed.length ? mixed : shuffle(filtered)
}

function buildLessonItems(pool, lessonKind = 'morning') {
  const base = shuffle(pool).slice(0, lessonKind === 'morning' ? 5 : 4)
  if (!base.length) return []

  const lesson = []
  const first = base[0]
  const second = base[1] || base[0]
  const third = base[2] || base[0]
  const fourth = base[3] || base[1] || base[0]

  if (lessonKind === 'morning') {
    lesson.push({ type: 'learn', item: first })
    lesson.push({ type: 'learn', item: second })
    lesson.push({ type: 'mcq', item: first, choices: shuffle([first.english, second.english, third.english]).slice(0, 3) })
    lesson.push({ type: 'typing', item: second })
    lesson.push({ type: 'learn', item: third })
    lesson.push({ type: 'listen', item: third, choices: shuffle([third.english, first.english, fourth.english]).slice(0, 3) })
    lesson.push({ type: 'reading', item: fourth })
    lesson.push({ type: 'review', item: first })
  } else {
    lesson.push({ type: 'review', item: first })
    lesson.push({ type: 'typing', item: second })
    lesson.push({ type: 'mcq', item: third, choices: shuffle([third.english, first.english, second.english]).slice(0, 3) })
    lesson.push({ type: 'listen', item: first, choices: shuffle([first.english, second.english, fourth.english]).slice(0, 3) })
    lesson.push({ type: 'reading', item: fourth })
    lesson.push({ type: 'review', item: second })
  }

  return lesson
}

function browserHasSpeechRecognition() {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

function IconButton({ children, onClick, secondary = false, disabled = false }) {
  return (
    <button className={`button ${secondary ? 'button-secondary' : 'button-primary'}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default function App() {
  const [mode, setMode] = useState('lesson')
  const [track, setTrack] = useState('All Tracks')
  const [lessonKind, setLessonKind] = useState('morning')
  const [progress, setProgress] = useState({})
  const [adaptiveMode, setAdaptiveMode] = useState(true)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [lesson, setLesson] = useState([])
  const [stepIndex, setStepIndex] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceFeedback, setVoiceFeedback] = useState(null)
  const dailyGoal = 2
  const streak = 4
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    setProgress(getStoredProgress())
    setVoiceSupported(browserHasSpeechRecognition())
  }, [])

  useEffect(() => {
    saveStoredProgress(progress)
  }, [progress])

  const tracks = ['All Tracks', ...new Set(PHRASES.map((p) => p.track))]

  const rebuildLesson = useCallback(() => {
    const pool = adaptiveMode
      ? buildAdaptivePool(PHRASES, progress, track)
      : shuffle(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track))
    const nextLesson = buildLessonItems(pool, lessonKind)
    setLesson(nextLesson)
    setStepIndex(0)
    setInput('')
    setFeedback(null)
    setShowAnswer(false)
    setSpokenText('')
    setVoiceFeedback(null)
    setIsListening(false)
  }, [adaptiveMode, progress, track, lessonKind])

  useEffect(() => {
    rebuildLesson()
  }, [rebuildLesson])

  const currentStep = lesson[stepIndex] || null
  const current = currentStep?.item || PHRASES[0]
  const lessonComplete = lesson.length > 0 && stepIndex >= lesson.length

  const masteredCount = useMemo(() => Object.values(progress).filter((p) => p?.mastered).length, [progress])
  const correctToday = useMemo(() => Object.values(progress).reduce((acc, p) => acc + (p?.correct || 0), 0), [progress])
  const overallProgress = Math.min(100, Math.round((masteredCount / PHRASES.length) * 100))
  const lessonProgress = lesson.length ? Math.round((Math.min(stepIndex, lesson.length) / lesson.length) * 100) : 0

  const categoryStats = useMemo(() => {
    const cats = [...new Set(PHRASES.map((p) => p.category))]
    return cats.map((cat) => {
      const items = PHRASES.filter((p) => p.category === cat)
      const mastered = items.filter((p) => progress[p.id]?.mastered).length
      return { cat, total: items.length, mastered }
    })
  }, [progress])

  const speak = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ar-SA'
    utter.rate = 0.8
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  const markProgress = (isCorrect, spoken = false) => {
    setProgress((prev) => {
      const prevItem = getItemStats(prev, current.id)
      const updated = {
        ...prevItem,
        correct: prevItem.correct + (isCorrect ? 1 : 0),
        wrong: prevItem.wrong + (isCorrect ? 0 : 1),
        spoken: prevItem.spoken + (spoken ? 1 : 0),
      }
      updated.mastered = updated.correct >= 3 && updated.correct > updated.wrong
      return { ...prev, [current.id]: updated }
    })
  }

  const goNext = () => {
    setInput('')
    setFeedback(null)
    setShowAnswer(false)
    setSpokenText('')
    setVoiceFeedback(null)
    setStepIndex((s) => s + 1)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const checkTyping = () => {
    const ok = normalizeText(input) === normalizeText(current.answer) || normalizeText(input) === normalizeText(current.english)
    setFeedback(ok ? 'correct' : 'wrong')
    markProgress(ok)
  }

  const checkChoice = (choice) => {
    const ok = normalizeText(choice) === normalizeText(current.english)
    setFeedback(ok ? 'correct' : 'wrong')
    markProgress(ok)
  }

  const startVoicePractice = () => {
    if (!voiceSupported || typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.lang = 'ar-SA'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setSpokenText('')
      setVoiceFeedback(null)
    }

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || ''
      setSpokenText(transcript)
      const ok = normalizeText(transcript) === normalizeText(current.arabic)
      setVoiceFeedback(ok ? 'correct' : 'heard')
      markProgress(ok, true)
    }

    recognition.onerror = () => {
      setVoiceFeedback('error')
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopVoicePractice = () => {
    recognitionRef.current?.stop?.()
    setIsListening(false)
  }

  const resetAll = () => {
    localStorage.removeItem('arabic-dad-progress-v2')
    setProgress({})
    rebuildLesson()
  }

  const weakPractice = () => {
    const weakPool = PHRASES.filter((p) => {
      const s = getItemStats(progress, p.id)
      return s.wrong >= s.correct || !s.mastered
    })
    setLesson(buildLessonItems(shuffle(weakPool.length ? weakPool : PHRASES), 'evening'))
    setStepIndex(0)
    setInput('')
    setFeedback(null)
    setShowAnswer(false)
  }

  const renderFeedback = () => {
    if (feedback === 'correct') {
      return (
        <div className="feedback success">
          <CheckCircle2 size={22} />
          <div>
            <strong>Correct</strong>
            <div>Nicely done.</div>
          </div>
        </div>
      )
    }
    if (feedback === 'wrong') {
      return (
        <div className="feedback error">
          <XCircle size={22} />
          <div>
            <strong>Not quite</strong>
            <div>Correct answer: {current.english}</div>
          </div>
        </div>
      )
    }
    return null
  }

  const renderLessonStep = () => {
    if (!currentStep) return null

    if (['learn', 'review', 'reading'].includes(currentStep.type)) {
      return (
        <div className="stack-lg">
          <div className="row-between">
            <span className="pill soft">{current.category}</span>
            <span className="pill">{current.level}</span>
          </div>
          <div className="center stack-md">
            <div className="arabic-text" dir="rtl">{current.arabic}</div>
            <div className="translit">{current.transliteration}</div>
            <div className="meaning">{current.english}</div>
            <div className="muted">{current.notes}</div>
          </div>
          <div className="center">
            <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={18} />Play Arabic</IconButton>
          </div>
          {voiceSupported && (
            <div className="subpanel">
              <div className="subpanel-title">Say the Arabic aloud</div>
              <div className="button-grid-2">
                <IconButton secondary onClick={isListening ? stopVoicePractice : startVoicePractice}>
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  {isListening ? 'Stop' : 'Voice practice'}
                </IconButton>
                <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={18} />Hear again</IconButton>
              </div>
              {spokenText && <div className="muted">Heard: {spokenText}</div>}
              {voiceFeedback === 'correct' && <div className="voice-good">Good pronunciation match.</div>}
              {voiceFeedback === 'heard' && <div className="muted">Good try. The phrase sounded a bit different.</div>}
              {voiceFeedback === 'error' && <div className="voice-bad">Voice input did not work this time.</div>}
            </div>
          )}
          <IconButton onClick={goNext}>Continue</IconButton>
        </div>
      )
    }

    if (currentStep.type === 'typing') {
      return (
        <div className="stack-lg">
          <div className="row-between">
            <span className="pill soft">Typing</span>
            <span className="pill">{current.level}</span>
          </div>
          <div className="center stack-md">
            <div className="arabic-text" dir="rtl">{current.arabic}</div>
            <div className="translit">{current.transliteration}</div>
            <div className="muted">Type the meaning in English</div>
          </div>
          <div className="center">
            <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={18} />Play Arabic</IconButton>
          </div>
          <input
            ref={inputRef}
            className="text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type in English"
          />
          <div className="button-grid-2">
            <IconButton onClick={checkTyping}>Check</IconButton>
            <IconButton secondary onClick={() => setShowAnswer(true)}>Show answer</IconButton>
          </div>
          {showAnswer && <div className="answer-box">{current.english}</div>}
          {renderFeedback()}
          <IconButton secondary onClick={goNext}>Next step</IconButton>
        </div>
      )
    }

    if (currentStep.type === 'mcq' || currentStep.type === 'listen') {
      const isListen = currentStep.type === 'listen'
      return (
        <div className="stack-lg">
          <div className="row-between">
            <span className="pill soft">{isListen ? 'Listening' : 'Choose the meaning'}</span>
            <span className="pill">{current.level}</span>
          </div>
          <div className="center stack-md">
            {isListen ? (
              <>
                <div className="muted">Tap to hear the Arabic, then choose the meaning.</div>
                <IconButton secondary onClick={() => speak(current.arabic)}><Volume2 size={18} />Play Arabic</IconButton>
              </>
            ) : (
              <>
                <div className="arabic-text" dir="rtl">{current.arabic}</div>
                <div className="translit">{current.transliteration}</div>
              </>
            )}
          </div>
          <div className="stack-sm">
            {currentStep.choices.map((choice) => (
              <button key={choice} className="choice-button" onClick={() => checkChoice(choice)}>{choice}</button>
            ))}
          </div>
          {renderFeedback()}
          <IconButton secondary onClick={goNext}>Next step</IconButton>
        </div>
      )
    }

    return null
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <section className="card">
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
            <div className="mini-card"><span>Streak</span><strong>{streak} 🔥</strong></div>
          </div>

          <div className="progress-block">
            <div className="row-between small"><span>Overall progress</span><span>{overallProgress}%</span></div>
            <div className="progress-bar"><div style={{ width: `${overallProgress}%` }} /></div>
          </div>
          <div className="subpanel">
            <div className="row-between small"><span>Current lesson</span><span>{lessonProgress}%</span></div>
            <div className="progress-bar thin"><div style={{ width: `${lessonProgress}%` }} /></div>
          </div>
        </section>

        <section className="tabs-grid">
          {[
            ['lesson', BookOpen, 'Lesson'],
            ['listen', Ear, 'Listen'],
            ['phrasebook', ScrollText, 'Phrases'],
            ['review', Star, 'Review'],
          ].map(([value, Icon, label]) => (
            <button key={value} className={`tab-button ${mode === value ? 'active' : ''}`} onClick={() => setMode(value)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </section>

        <section className="chip-row">
          {tracks.map((t) => (
            <button key={t} onClick={() => setTrack(t)} className={`chip ${track === t ? 'chip-active' : ''}`}>{t}</button>
          ))}
        </section>

        <section className="button-grid-2">
          <button className="toggle-card" onClick={() => setLessonKind((v) => (v === 'morning' ? 'evening' : 'morning'))}>
            <Brain size={16} /> {lessonKind === 'morning' ? 'Morning lesson' : 'Evening lesson'}
          </button>
          <button className={`toggle-card ${adaptiveMode ? 'toggle-active' : ''}`} onClick={() => setAdaptiveMode((v) => !v)}>
            <TrendingUp size={16} /> Adaptive {adaptiveMode ? 'On' : 'Off'}
          </button>
        </section>

        {mode === 'lesson' && (
          <section className="card">
            {lessonComplete ? (
              <div className="stack-lg center">
                <h2>Lesson complete 🎉</h2>
                <p className="muted">A clean stopping point, just like Duolingo.</p>
                <IconButton onClick={rebuildLesson}>Start next lesson</IconButton>
                <IconButton secondary onClick={() => setMode('review')}>Go to review</IconButton>
              </div>
            ) : (
              <>
                <div className="row-between section-top">
                  <span className="pill soft">Step {stepIndex + 1} / {lesson.length}</span>
                  <span className="small muted">{current.track}</span>
                </div>
                {renderLessonStep()}
              </>
            )}
          </section>
        )}

        {mode === 'listen' && (
          <section className="card stack-md">
            <div>
              <h2>Listening practice</h2>
              <p className="muted">Tap a phrase to hear it in Arabic.</p>
            </div>
            {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).slice(0, 10).map((item) => (
              <button key={item.id} className="list-card" onClick={() => speak(item.arabic)}>
                <div>
                  <div className="list-arabic" dir="rtl">{item.arabic}</div>
                  <div className="translit small">{item.transliteration}</div>
                  <div className="muted small">{item.english}</div>
                </div>
                <PlayCircle size={22} />
              </button>
            ))}
          </section>
        )}

        {mode === 'phrasebook' && (
          <section className="card stack-md">
            <div>
              <h2>Phrasebook & reading bank</h2>
              <p className="muted">Browse by track: daily Arabic, reading Arabic, and culture & proverbs.</p>
            </div>
            {(track === 'All Tracks' ? PHRASES : PHRASES.filter((p) => p.track === track)).map((item) => (
              <div key={item.id} className="phrase-card">
                <div className="row-between wrap-gap">
                  <span className="pill soft">{item.category}</span>
                  <div className="row gap-sm">
                    <span className="pill">{item.level}</span>
                    <button className="icon-only" onClick={() => speak(item.arabic)} aria-label="Play Arabic audio"><Volume2 size={16} /></button>
                  </div>
                </div>
                <div className="list-arabic" dir="rtl">{item.arabic}</div>
                <div className="translit small">{item.transliteration}</div>
                <div className="meaning">{item.english}</div>
                <div className="muted small">{item.notes}</div>
              </div>
            ))}
          </section>
        )}

        {mode === 'review' && (
          <section className="card stack-md">
            <div>
              <h2>Review & progress</h2>
              <p className="muted">Adaptive mode surfaces weaker items first, then adds a few stronger items to keep him moving ahead.</p>
            </div>
            {categoryStats.map((row) => (
              <div key={row.cat} className="progress-card">
                <div className="row-between small"><span>{row.cat}</span><span>{row.mastered}/{row.total}</span></div>
                <div className="progress-bar thin"><div style={{ width: `${(row.mastered / row.total) * 100}%` }} /></div>
              </div>
            ))}
            <div className="stack-sm">
              <IconButton onClick={weakPractice}><Shuffle size={16} />Practice weak phrases</IconButton>
              <IconButton secondary onClick={resetAll}><RotateCcw size={16} />Reset progress</IconButton>
            </div>
            <div className="subpanel muted small">
              Correct answers logged: <strong>{correctToday}</strong><br />
              Voice practice is optional and only appears on browsers that expose speech recognition.<br />
              Progress is saved in the phone browser using local storage.
            </div>
          </section>
        )}

        <section className="card stack-md">
          <div className="row gap-sm section-title"><Languages size={16} />What this version now does</div>
          <ul className="info-list">
            <li>Duolingo-like finite lessons with a clean stopping point</li>
            <li>Adaptive sequencing to keep weak items in rotation</li>
            <li>Optional voice recognition practice on supported mobile browsers</li>
            <li>Tracks for everyday Arabic, reading Arabic, and culture</li>
            <li>Phrasebook, listening mode, and review mode in one calm mobile UI</li>
          </ul>
          <div className="subpanel">
            <div className="row gap-sm section-title"><Newspaper size={16} />Next production upgrades</div>
            <div className="muted">Real audio files, better Arabic speech matching, larger phrase library, spaced repetition scheduling by day, and an admin content uploader for you.</div>
          </div>
        </section>
      </div>
    </div>
  )
}
