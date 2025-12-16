import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

import PixwikLogo from "@/assets/pixwik-logo.svg";
import { API, getAxiosConfig, extractErrorMessage } from "@/config/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function JobPosting() {
  const { slug } = useParams();
  const [state, setState] = useState({ status: "loading", error: null, job: null });
  const [showMobileLogo, setShowMobileLogo] = useState(true);

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
      try {
        const res = await axios.get(`${API}/jobs/${slug}`, getAxiosConfig());
        if (!mounted) return;
        setState({ status: "ready", error: null, job: res.data });
      } catch (e) {
        const msg = extractErrorMessage(e, "Job not found");
        if (!mounted) return;
        setState({ status: "error", error: msg, job: null });
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const job = state.job;

  const applyHref = useMemo(() => {
    // Auto-tag: pass slug so the quest can attach it to the application.
    const base = job?.application_url || "/quest";
    const joiner = base.includes("?") ? "&" : "?";
    return `${base}${joiner}job=${encodeURIComponent(slug)}`;
  }, [job?.application_url, slug]);

  return (
    <div className="quest-page" data-testid="job-posting-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="job-posting-backdrop" />

      <a
        href="/"
        className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
        data-testid="job-posting-logo-link"
        aria-label="Pixwik"
      >
        <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="job-posting-logo-img" />
      </a>

      <main className="quest-container" data-testid="job-posting-container">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5" data-testid="job-posting-top-actions">
          <div className="text-sm text-slate-600">Already applied?</div>
          <a href="/candidate" data-testid="job-posting-candidate-portal-link">
            <Button variant="secondary" size="sm">Candidate Portal</Button>
          </a>
        </div>
        {state.status === "error" ? (
          <div className="quest-error" data-testid="job-posting-error">
            {extractErrorMessage(state.error)}
          </div>
        ) : null}

        {state.status === "loading" ? (
          <div className="text-sm text-slate-600" data-testid="job-posting-loading">
            Loading…
          </div>
        ) : null}

        {state.status === "ready" && job ? (
          <div className="space-y-6" data-testid="job-posting-content">
            <div className="space-y-3" data-testid="job-posting-header">
              <div className="flex flex-wrap items-center gap-2" data-testid="job-posting-badges">
                <Badge className="quest-mini-badge" data-testid="job-posting-type">
                  {job.type === "campus_event" ? "Campus hiring event" : "Job posting"}
                </Badge>
                <Badge className="quest-mini-badge" data-testid="job-posting-work-mode">
                  {job.work_mode || "Remote"}
                </Badge>
                <Badge className="quest-mini-badge" data-testid="job-posting-employment">
                  {job.employment_type || "Internship"}
                </Badge>
                <Badge className="quest-mini-badge" data-testid="job-posting-stipend">
                  Stipend: {job.stipend || "TBD"}
                </Badge>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="job-posting-title">
                {job.title}
              </h1>
              <p className="text-base md:text-lg text-slate-700 max-w-3xl" data-testid="job-posting-subtitle">
                {job.short_description}
              </p>

              <div className="flex flex-wrap gap-2" data-testid="job-posting-meta">
                {job.location ? (
                  <Badge variant="secondary" data-testid="job-posting-location">
                    {job.location}
                  </Badge>
                ) : null}
                {job.deadline ? (
                  <Badge variant="secondary" data-testid="job-posting-deadline">
                    Apply by {formatDate(job.deadline)}
                  </Badge>
                ) : null}
                {job.event_date ? (
                  <Badge variant="secondary" data-testid="job-posting-event-date">
                    Event: {formatDate(job.event_date)}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="job-posting-grid">
              <div className="lg:col-span-2" data-testid="job-posting-left">
                <Card className="quest-card" data-testid="job-description-card">
                  <CardHeader>
                    <CardTitle data-testid="job-description-title">Details</CardTitle>
                    <CardDescription data-testid="job-description-desc">What you can expect.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {job.full_description ? (
                      <div className="text-sm text-slate-800 whitespace-pre-wrap" data-testid="job-full-description">
                        {job.full_description}
                      </div>
                    ) : null}

                    {job.role_overview ? (
                      <div className="text-sm text-slate-800 whitespace-pre-wrap" data-testid="job-role-overview">
                        {job.role_overview}
                      </div>
                    ) : null}

                    {job.requirements?.length ? (
                      <div data-testid="job-requirements">
                        <div className="font-medium text-slate-900" data-testid="job-requirements-title">
                          Requirements
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-800">
                          {job.requirements.map((r, idx) => (
                            <li key={`${idx}-${r}`} data-testid={`job-requirement-${idx}`}>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {job.bonus?.length ? (
                      <div data-testid="job-bonus">
                        <div className="font-medium text-slate-900" data-testid="job-bonus-title">
                          Nice to have
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-800">
                          {job.bonus.map((b, idx) => (
                            <li key={`${idx}-${b}`} data-testid={`job-bonus-${idx}`}>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1" data-testid="job-posting-right">
                <Card className="quest-card" data-testid="job-apply-card">
                  <CardHeader>
                    <CardTitle data-testid="job-apply-title">Apply</CardTitle>
                    <CardDescription data-testid="job-apply-desc">Complete the Developer Quest to apply.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-slate-700" data-testid="job-apply-process">
                      3-month internship → performance-based conversion to a permanent role.
                    </div>

                    <Separator />

                    <a href={applyHref} data-testid="job-apply-link">
                      <Button className="quest-primary w-full" data-testid="job-apply-button">
                        Start Developer Quest
                      </Button>
                    </a>

                    <div className="text-xs text-slate-600" data-testid="job-apply-note">
                      This form is used for the campus event and future early-talent roles.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
