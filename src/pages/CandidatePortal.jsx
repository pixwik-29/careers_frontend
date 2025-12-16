import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import PixwikLogo from "@/assets/pixwik-logo.svg";
import { API, getAxiosConfig, extractErrorMessage } from "@/config/api";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const TOKEN_KEY = "pixwik_candidate_token";

export default function CandidatePortal() {
  const navigate = useNavigate();

  const [showMobileLogo, setShowMobileLogo] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginState, setLoginState] = useState({ status: "idle", error: null });

  const [meState, setMeState] = useState({ status: "idle", error: null, data: null });

  const isAuthed = Boolean(token);

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

  async function fetchMe(activeToken) {
    setMeState({ status: "loading", error: null, data: null });
    try {
      const res = await axios.get(`${API}/candidate/me`, getAxiosConfig({
        headers: { Authorization: `Bearer ${activeToken}` },
      }));
      setMeState({ status: "ready", error: null, data: res.data });
    } catch (e) {
      const msg = extractErrorMessage(e, "Failed to load portal");
      setMeState({ status: "error", error: msg, data: null });
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    const t = setTimeout(() => fetchMe(token), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [isAuthed]);

  async function login() {
    setLoginState({ status: "loading", error: null });
    try {
      const res = await axios.post(`${API}/candidate/auth/login`, loginForm, getAxiosConfig());
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      setLoginState({ status: "idle", error: null });
    } catch (e) {
      const msg = extractErrorMessage(e, "Login failed");
      setLoginState({ status: "error", error: msg });
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMeState({ status: "idle", error: null, data: null });
  }

  const candidate = meState.data?.candidate;
  const round = meState.data?.round;

  const statusMessage = useMemo(() => {
    if (!candidate) return "";
    if (candidate.status === "Rejected") return "Your application is no longer in process.";
    if (candidate.status === "Selected") return "Congratulations — you’ve been selected!";

    if (round?.is_quiz) {
      if (candidate.quiz_status === "Completed") return "Quiz submitted. Please wait for evaluation.";
      if (candidate.quiz_status === "In Progress") return "Quiz is in progress. You can submit once.";
      return "This round includes an online quiz.";
    }

    return "Please wait for the next instruction. This round is evaluated offline.";
  }, [candidate, round]);

  return (
    <div className="quest-page" data-testid="candidate-portal-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="candidate-portal-backdrop" />

      <a
        href="/candidate"
        className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
        data-testid="candidate-logo-link"
        aria-label="Pixwik"
      >
        <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="candidate-logo-img" />
      </a>

      <main className="quest-container" data-testid="candidate-portal-container">
        <div className="mb-6" data-testid="candidate-portal-header">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="candidate-portal-title">
            Candidate Portal
          </h1>
          <p className="text-base md:text-lg text-slate-700" data-testid="candidate-portal-subtitle">
            Track your current round and complete the quiz when it unlocks.
          </p>
        </div>

        {!isAuthed ? (
          <Card className="quest-card" data-testid="candidate-login-card">
            <CardHeader>
              <CardTitle data-testid="candidate-login-title">Login</CardTitle>
              <CardDescription data-testid="candidate-login-desc">
                Use the email + password sent to you after submitting the Developer Quest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loginState.error ? (
                <div className="quest-error" data-testid="candidate-login-error">
                  {extractErrorMessage(loginState.error)}
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="candidate-login-fields">
                <div className="space-y-2" data-testid="candidate-login-email-field">
                  <Label htmlFor="candEmail">Email</Label>
                  <Input
                    id="candEmail"
                    value={loginForm.email}
                    data-testid="candidate-login-email-input"
                    onChange={(e) => setLoginForm((s) => ({ ...s, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2" data-testid="candidate-login-password-field">
                  <Label htmlFor="candPass">Password</Label>
                  <Input
                    id="candPass"
                    type="password"
                    value={loginForm.password}
                    data-testid="candidate-login-password-input"
                    onChange={(e) => setLoginForm((s) => ({ ...s, password: e.target.value }))}
                    placeholder="••••••••••"
                  />
                </div>
              </div>

              <Button
                className="quest-primary"
                data-testid="candidate-login-button"
                onClick={login}
                disabled={loginState.status === "loading"}
              >
                {loginState.status === "loading" ? "Signing in…" : "Sign in"}
              </Button>

              <div className="text-sm text-slate-600" data-testid="candidate-login-help">
                Didn’t receive the email? Check spam or contact careers@pixwik.com.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="quest-card" data-testid="candidate-dashboard-card">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3" data-testid="candidate-dashboard-toprow">
                <div>
                  <CardTitle data-testid="candidate-dashboard-title">Welcome{candidate?.full_name ? `, ${candidate.full_name}` : ""}</CardTitle>
                  <CardDescription data-testid="candidate-dashboard-desc">Your recruitment progress at Pixwik.</CardDescription>
                </div>
                <Button variant="secondary" data-testid="candidate-logout-button" onClick={logout}>
                  Logout
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {meState.status === "loading" ? (
                <div className="text-sm text-slate-600" data-testid="candidate-loading">Loading…</div>
              ) : null}

              {meState.error ? (
                <div className="quest-error" data-testid="candidate-error">{extractErrorMessage(meState.error)}</div>
              ) : null}

              {candidate && round ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="candidate-portal-stats">
                    <Card className="quest-card" data-testid="candidate-portal-stat-job">
                      <CardHeader>
                        <CardDescription>Job applied</CardDescription>
                        <CardTitle className="text-lg" data-testid="candidate-portal-job-title">
                          {candidate.job_title || "—"}
                        </CardTitle>
                        {candidate.job_slug ? (
                          <div className="text-xs text-slate-500" data-testid="candidate-portal-job-slug">
                            {candidate.job_slug}
                          </div>
                        ) : null}
                      </CardHeader>
                    </Card>
                    <Card className="quest-card" data-testid="candidate-portal-stat-round">
                      <CardHeader>
                        <CardDescription>Current round</CardDescription>
                        <CardTitle className="text-lg" data-testid="candidate-portal-current-round">
                          {candidate.current_round}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="quest-card" data-testid="candidate-portal-stat-status">
                      <CardHeader>
                        <CardDescription>Status</CardDescription>
                        <CardTitle className="text-lg" data-testid="candidate-portal-status">
                          {candidate.status}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="quest-card" data-testid="candidate-portal-stat-quiz">
                      <CardHeader>
                        <CardDescription>Assessment</CardDescription>
                        <CardTitle className="text-lg" data-testid="candidate-portal-quiz-status">
                          {candidate.quiz_status}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <Separator />

                  <div className="text-sm text-slate-700 whitespace-pre-wrap" data-testid="candidate-round-description">
                    {round.round_description}
                  </div>

                  <div className="quest-hint" data-testid="candidate-status-message">
                    {statusMessage}
                  </div>

{/* {round.is_quiz ? "true" : "false"}
{candidate.status}
{candidate.quiz_status}
{candidate.status === "Active" && candidate.quiz_status !== "Completed" ? "true" : "false"} */}

                  {round.is_quiz && candidate.status === "Pending" && candidate.quiz_status !== "Completed" ? (
                    <Button
                      className="quest-primary"
                      data-testid="candidate-start-quiz-button"
                      onClick={() => navigate("/candidate/quiz")}
                    >
                      Start Quiz
                    </Button>
                  ) : null}

                  {round.is_quiz && candidate.quiz_status === "Completed" ? (
                    <div className="text-sm text-slate-600" data-testid="candidate-quiz-locked">
                      Quiz already submitted. You can’t resubmit.
                    </div>
                  ) : null}

                  {round.is_coding && candidate.status === "Active" ? (
                    <Button
                      className="quest-primary"
                      data-testid="candidate-start-coding-button"
                      onClick={() => navigate("/candidate/coding")}
                    >
                      Start Coding Task
                    </Button>
                  ) : null}

                  {!round.is_quiz && !round.is_coding ? (
                    <div className="text-sm text-slate-600" data-testid="candidate-offline-note">
                      This round is offline. We’ll email you when you move to the next round.
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
