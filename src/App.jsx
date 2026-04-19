// FULL CLEAN STABLE VERSION

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2, CheckCircle2, XCircle, RotateCcw, BookOpen, Ear, Shuffle, Star,
  PlayCircle, ScrollText, Languages, Mic, MicOff, TrendingUp, Brain,
  Download, Trophy, Sparkles
} from 'lucide-react';
import { PHRASES } from './phrases';

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/[؟?!.,']/g, '').replace(/\s+/g, ' ').trim();
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ---------- STORAGE ----------
function getStoredProgress() {
  try { return JSON.parse(localStorage.getItem('arabic-progress') || '{}'); }
  catch { return {}; }
}
function saveStoredProgress(p) {
  localStorage.setItem('arabic-progress', JSON.stringify(p));
}
function getStoredMeta() {
  try {
    return JSON.parse(localStorage.getItem('arabic-meta') || '{"lessons":0}');
  } catch { return { lessons: 0 }; }
}
function saveStoredMeta(m) {
  localStorage.setItem('arabic-meta', JSON.stringify(m));
}

// ---------- SESSION ----------
function getSession() {
  const h = new Date().getHours();
  return h < 15 ? "morning" : "evening";
}

// ---------- TASK GENERATOR ----------
function generateTasks(phrases) {
  const tasks = [];
  phrases.forEach((item) => {
    tasks.push({ type: 'learn', item });
    tasks.push({ type: 'mcq', item });
    tasks.push({ type: 'typing', item });
    tasks.push({ type: 'listen', item });
  });
  return tasks;
}

// ---------- APP ----------
export default function App() {

  const [lesson, setLesson] = useState([]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [progress, setProgress] = useState({});
  const [meta, setMeta] = useState({ lessons: 0 });
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);

  // ---------- LOAD ----------
  useEffect(() => {
    setProgress(getStoredProgress());
    setMeta(getStoredMeta());
  }, []);

  useEffect(() => saveStoredProgress(progress), [progress]);
  useEffect(() => saveStoredMeta(meta), [meta]);

  // ---------- API GENERATION ----------
  const generateLesson = async () => {
    try {
      setLoading(true);

      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: getSession() })
      });

      const data = await res.json();

      const phrases = (data.source_phrases || []).filter(p => p.arabic && p.english);

      setLesson(generateTasks(phrases));
      setStep(0);
      setInput('');
      setFeedback(null);

    } catch (e) {
      alert("API failed — using built-in lesson");
      useBuiltIn();
    } finally {
      setLoading(false);
    }
  };

  // ---------- BUILT-IN ----------
  const useBuiltIn = () => {
    const phrases = shuffle(PHRASES).slice(0, 8);
    setLesson(generateTasks(phrases));
    setStep(0);
  };

  // ---------- NAV ----------
  const next = () => {
    setStep(s => {
      const n = s + 1;
      if (n >= lesson.length) {
        setMeta(m => ({ ...m, lessons: m.lessons + 1 }));
      }
      return n;
    });
    setInput('');
    setFeedback(null);
  };

  const back = () => {
    setStep(s => Math.max(0, s - 1));
    setInput('');
    setFeedback(null);
  };

  const current = lesson[step]?.item;

  // ---------- CHECK ----------
  const check = () => {
    const ok = normalizeText(input) === normalizeText(current.english);
    setFeedback(ok ? "correct" : "wrong");

    setProgress(p => {
      const prev = p[current.id] || { c: 0, w: 0 };
      return {
        ...p,
        [current.id]: {
          c: prev.c + (ok ? 1 : 0),
          w: prev.w + (ok ? 0 : 1)
        }
      };
    });
  };

  // ---------- UI ----------
  if (!lesson.length) {
    return (
      <div className="card">
        <h1>Arabic Companion</h1>
        <button onClick={generateLesson}>
          {loading ? "Generating..." : "Start Lesson"}
        </button>
      </div>
    );
  }

  if (step >= lesson.length) {
    return (
      <div className="card">
        <h2>Lesson Complete 🎉</h2>
        <button onClick={generateLesson}>Next Lesson</button>
      </div>
    );
  }

  const task = lesson[step];

  return (
    <div className="card">

      <h3>Step {step + 1} / {lesson.length}</h3>

      <div dir="rtl" style={{ fontSize: 28 }}>{current.arabic}</div>
      <div>{current.transliteration}</div>

      {task.type === "typing" && (
        <>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button onClick={check}>Check</button>
        </>
      )}

      {feedback === "correct" && <div style={{ color: "green" }}>Correct</div>}
      {feedback === "wrong" && <div style={{ color: "red" }}>Answer: {current.english}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={back} disabled={step === 0}>Back</button>
        <button onClick={next}>Next</button>
      </div>

    </div>
  );
}
