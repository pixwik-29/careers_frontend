import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";

import PixwikLogo from "@/assets/pixwik-logo.svg";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://5ce2ff1765f7.ngrok-free.app";
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

export default function CandidateCoding() {
  const navigate = useNavigate();

  const [showMobileLogo, setShowMobileLogo] = useState(true);
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");

  const [state, setState] = useState({ status: "loading", error: null, round: null, problem: null });
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");

  const [runState, setRunState] = useState({ status: "idle", error: null, result: null });
  const [submitState, setSubmitState] = useState({ status: "idle", error: null, result: null });

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
        const res = await axios.get(`${API}/candidate/coding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;

        const problem = res.data.problem;
        setState({ status: "ready", error: null, round: res.data.round, problem });

        // Initialize starter code based on language
        setCode(problem?.starter_python || "");
        setLanguage("python");
      } catch (e) {
        const msg = e?.response?.data?.detail || "Failed to load coding task";
        if (!mounted) return;
        setState({ status: "error", error: msg, round: null, problem: null });
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [navigate, token]);

  const starterByLang = useMemo(() => {
    if (!state.problem) return { python: "", javascript: "" };
    return {
      python: state.problem.starter_python || "",
      javascript: state.problem.starter_javascript || "",
    };
  }, [state.problem]);

  function onChangeLanguage(next) {
    setLanguage(next);
    // If code is empty or still equals one starter, replace with the new starter.
    const currentStarter = starterByLang[language] || "";
    if (!code || code === currentStarter) {
      setCode(starterByLang[next] || "");
    }
  }

  async function run() {
    setRunState({ status: "loading", error: null, result: null });
    try {
      const res = await axios.post(
        `${API}/candidate/coding/run`,
        { language, code },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRunState({ status: "ready", error: null, result: res.data });
    } catch (e) {
      const msg = e?.response?.data?.detail || "Run failed";
      setRunState({ status: "error", error: msg, result: null });
    }
  }

  async function submit() {
    const ok = window.confirm("Submit final solution? You can only submit once.");
    if (!ok) return;

    setSubmitState({ status: "loading", error: null, result: null });
    try {
      const res = await axios.post(
        `${API}/candidate/coding/submit`,
        { language, code },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSubmitState({ status: "ready", error: null, result: res.data });
      navigate("/candidate");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Submit failed";
      setSubmitState({ status: "error", error: msg, result: null });
    }
  }

  return (
    <div className="quest-page" data-testid="candidate-coding-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="candidate-coding-backdrop" />

      <a
        href="/"
        className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
        data-testid="candidate-coding-logo-link"
        aria-label="Pixwik"
      >
        <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="candidate-coding-logo-img" />
      </a>

      <main className="quest-container" data-testid="candidate-coding-container">
        <div className="mb-6 flex items-center justify-between gap-3" data-testid="candidate-coding-header">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="candidate-coding-title">
              Coding Task
            </h1>
            <p className="text-base md:text-lg text-slate-700" data-testid="candidate-coding-subtitle">
              Write code, run tests, then submit once.
            </p>
          </div>
          <Button variant="secondary" data-testid="candidate-coding-back" onClick={() => navigate("/candidate")}>
            Back
          </Button>
        </div>

        {state.status === "loading" ? (
          <div className="text-sm text-slate-600" data-testid="candidate-coding-loading">Loading…</div>
        ) : null}

        {state.status === "error" ? (
          <div className="quest-error" data-testid="candidate-coding-error">{state.error}</div>
        ) : null}

        {state.status === "ready" && state.problem ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="candidate-coding-grid">
            <Card className="quest-card lg:col-span-1" data-testid="candidate-coding-problem-card">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle data-testid="candidate-coding-problem-title">{state.problem.title}</CardTitle>
                    <CardDescription data-testid="candidate-coding-problem-difficulty">
                      Difficulty: {state.problem.difficulty}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" data-testid="candidate-coding-round-badge">
                    {state.round?.round_name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-slate-800 whitespace-pre-wrap" data-testid="candidate-coding-problem-statement">
                  {state.problem.statement}
                </div>

                <Separator />

                <div className="space-y-2" data-testid="candidate-coding-language">
                  <div className="text-xs text-slate-500" data-testid="candidate-coding-language-label">Language</div>
                  <Select value={language} onValueChange={onChangeLanguage}>
                    <SelectTrigger data-testid="candidate-coding-language-select">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python" data-testid="candidate-coding-language-python">Python</SelectItem>
                      <SelectItem value="javascript" data-testid="candidate-coding-language-javascript">JavaScript</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-2" data-testid="candidate-coding-actions">
                  <Button
                    className="quest-primary"
                    data-testid="candidate-coding-run-button"
                    onClick={run}
                    disabled={runState.status === "loading" || submitState.status === "loading"}
                  >
                    {runState.status === "loading" ? "Running…" : "Run"}
                  </Button>
                  <Button
                    variant="secondary"
                    data-testid="candidate-coding-submit-button"
                    onClick={submit}
                    disabled={submitState.status === "loading"}
                  >
                    {submitState.status === "loading" ? "Submitting…" : "Submit"}
                  </Button>
                </div>

                {runState.error ? (
                  <div className="quest-error" data-testid="candidate-coding-run-error">{runState.error}</div>
                ) : null}

                {runState.result ? (
                  <div className="quest-hint" data-testid="candidate-coding-run-result">
                    Passed {runState.result.passed}/{runState.result.total} tests
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="quest-card lg:col-span-2" data-testid="candidate-coding-editor-card">
              <CardHeader>
                <CardTitle data-testid="candidate-coding-editor-title">Editor</CardTitle>
                <CardDescription data-testid="candidate-coding-editor-desc">
                  Tip: implement function <span className="font-mono">solve</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-slate-200/70" data-testid="candidate-coding-editor-wrapper">
                  <Editor
                    height="520px"
                    language={language === "python" ? "python" : "javascript"}
                    value={code}
                    onChange={(v) => setCode(v || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>

                {runState.result?.results?.length ? (
                  <Card className="quest-card" data-testid="candidate-coding-test-results-card">
                    <CardHeader>
                      <CardTitle className="text-lg" data-testid="candidate-coding-test-results-title">Test Results</CardTitle>
                      <CardDescription data-testid="candidate-coding-test-results-desc">
                        Hidden testcases are evaluated on the server.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {runState.result.results.map((r, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2"
                          data-testid={`candidate-coding-test-${idx}`}
                        >
                          <div className="text-xs text-slate-600" data-testid={`candidate-coding-test-input-${idx}`}>
                            Input: <span className="font-mono">{JSON.stringify(r.input)}</span>
                          </div>
                          <Badge variant="secondary" data-testid={`candidate-coding-test-pass-${idx}`}>
                            {r.passed ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
