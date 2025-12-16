import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import PixwikLogo from "@/assets/pixwik-logo.svg";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BACKEND_URL = "https://careersbackend.pixwik.com";
const API = `${BACKEND_URL}/api`;

// Helper function to add ngrok bypass header to axios config
function getAxiosConfig(config = {}) {
  return {
    ...config,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(config.headers || {})
    }
  };
}

const TOKEN_KEY = "pixwik_candidate_token";

export default function CandidateQuiz() {
  const navigate = useNavigate();

  const [showMobileLogo, setShowMobileLogo] = useState(true);
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");

  const [state, setState] = useState({ status: "loading", error: null, round: null, items: [] });
  const [answers, setAnswers] = useState({});
  const [submitState, setSubmitState] = useState({ status: "idle", error: null });

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth >= 768) {
        setShowMobileLogo(true);
        return;
      }
      setShowMobileLogo(window.scrollY < 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!token) {
        navigate("/candidate");
        return;
      }

      try {
        const res = await axios.get(`${API}/candidate/quiz`, getAxiosConfig({
          headers: { Authorization: `Bearer ${token}` },
        }));
        if (!mounted) return;
        setState({ status: "ready", error: null, round: res.data.round, items: res.data.items || [] });
      } catch (e) {
        const msg = e?.response?.data?.detail || "Failed to load quiz";
        if (!mounted) return;
        setState({ status: "error", error: msg, round: null, items: [] });
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [navigate, token]);

  const canSubmit = useMemo(() => {
    if (state.status !== "ready") return false;
    if (!state.items.length) return false;
    return state.items.every((q) => Boolean(answers[q.question_id]));
  }, [answers, state.items, state.status]);

  async function submit() {
    setSubmitState({ status: "loading", error: null });
    try {
      await axios.post(
        `${API}/candidate/quiz/submit`,
        { selected_answers: answers },
        getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }),
      );
      setSubmitState({ status: "success", error: null });
      navigate("/candidate");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Submission failed";
      setSubmitState({ status: "error", error: msg });
    }
  }

  return (
    <div className="quest-page" data-testid="candidate-quiz-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="candidate-quiz-backdrop" />

      <a
        href="/"
        className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
        data-testid="candidate-quiz-logo-link"
        aria-label="Pixwik"
      >
        <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="candidate-quiz-logo-img" />
      </a>

      <main className="quest-container" data-testid="candidate-quiz-container">
        <div className="mb-6 flex items-center justify-between gap-3" data-testid="candidate-quiz-header">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="candidate-quiz-title">
              Online Quiz
            </h1>
            <p className="text-base md:text-lg text-slate-700" data-testid="candidate-quiz-subtitle">
              Answer all questions and submit once.
            </p>
          </div>
          <Button variant="secondary" data-testid="candidate-quiz-back-button" onClick={() => navigate("/candidate")}>
            Back
          </Button>
        </div>

        {state.status === "loading" ? (
          <div className="text-sm text-slate-600" data-testid="candidate-quiz-loading">
            Loading…
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="quest-error" data-testid="candidate-quiz-error">
            {state.error}
          </div>
        ) : null}

        {state.status === "ready" ? (
          <Card className="quest-card" data-testid="candidate-quiz-card">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3" data-testid="candidate-quiz-card-top">
                <div>
                  <CardTitle data-testid="candidate-quiz-round-title">{state.round?.round_name || "Round"}</CardTitle>
                  <CardDescription data-testid="candidate-quiz-round-desc">{state.round?.round_description || ""}</CardDescription>
                </div>
                <Badge variant="secondary" data-testid="candidate-quiz-question-count">
                  {state.items.length} questions
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {state.items.map((q, idx) => (
                <div key={q.question_id} className="space-y-3" data-testid={`candidate-quiz-question-${q.question_id}`}>
                  <div className="font-medium text-slate-900" data-testid={`candidate-quiz-question-text-${q.question_id}`}>
                    {idx + 1}. {q.question_text}
                  </div>

                  <div className="grid grid-cols-1 gap-2" data-testid={`candidate-quiz-options-${q.question_id}`}>
                    {Object.entries(q.options || {}).map(([key, text]) => {
                      const active = answers[q.question_id] === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`quest-choice ${active ? "quest-choice--active" : ""}`}
                          data-testid={`candidate-quiz-option-${q.question_id}-${key}`}
                          onClick={() => setAnswers((s) => ({ ...s, [q.question_id]: key }))}
                        >
                          <div className="quest-choice__key" aria-hidden="true">
                            {key}
                          </div>
                          <div className="quest-choice__text">{text}</div>
                        </button>
                      );
                    })}
                  </div>

                  <Separator />
                </div>
              ))}

              {submitState.error ? (
                <div className="quest-error" data-testid="candidate-quiz-submit-error">
                  {submitState.error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3" data-testid="candidate-quiz-actions">
                <div className="text-sm text-slate-600" data-testid="candidate-quiz-progress">
                  Answered {Object.keys(answers).length}/{state.items.length}
                </div>

                <Button
                  className="quest-primary"
                  data-testid="candidate-quiz-submit-button"
                  onClick={submit}
                  disabled={!canSubmit || submitState.status === "loading"}
                >
                  {submitState.status === "loading" ? "Submitting…" : "Submit Quiz"}
                </Button>
              </div>

              <div className="text-xs text-slate-600" data-testid="candidate-quiz-lock-note">
                After submission, the quiz will be locked.
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
