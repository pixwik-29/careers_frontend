import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import PixwikLogo from "@/assets/pixwik-logo.svg";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BACKEND_URL ="https://careersbackend.pixwik.com";
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

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminPanel() {
  const [showMobileLogo, setShowMobileLogo] = useState(true);

  const [auth, setAuth] = useState({ username: "", password: "" });
  const [token, setToken] = useState("");

  const [tab, setTab] = useState("jobs"); // jobs | applications

  const [appsState, setAppsState] = useState({ status: "idle", error: null, rows: [], selected: null, csvUrl: null });
  const [jobsState, setJobsState] = useState({ status: "idle", error: null, rows: [], selected: null });

  const [jobDraft, setJobDraft] = useState({
    title: "",
    slug: "",
    type: "campus_event",
    team: "Engineering",
    employment_type: "Internship (3 months) → Full-time",
    work_mode: "Remote",
    location: "",
    stipend: "TBD",
    internship_duration: "3 months",
    short_description: "",
    full_description: "",
    requirementsText: "- ",
    bonusText: "- ",
    deadline: "",
    event_date: "",
    application_url: "/quest",
    is_published: true,
  });

  const isAuthed = Boolean(token);

  function parseBullets(text) {
    return (text || "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function login() {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.post(`${API}/admin/login`, auth);
      setToken(res.data.token);
      setAppsState((s) => ({ ...s, status: "idle", error: null }));
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Login failed";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadApplications() {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppsState((s) => ({ ...s, status: "idle", rows: res.data.items || [], error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load applications";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function openApplicationDetails(id) {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/applications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppsState((s) => ({ ...s, status: "idle", selected: res.data, error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to open application";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function exportApplicationsCsv() {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      setAppsState((s) => ({ ...s, status: "idle", csvUrl: url, error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "CSV export failed";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadJobs() {
    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobsState((s) => ({ ...s, status: "idle", rows: res.data.items || [], error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load jobs";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  function setDraftFromJob(job) {
    setJobDraft({
      title: job.title || "",
      slug: job.slug || "",
      type: job.type || "campus_event",
      team: job.team || "Engineering",
      employment_type: job.employment_type || "Internship (3 months) → Full-time",
      work_mode: job.work_mode || "Remote",
      location: job.location || "",
      stipend: job.stipend || "TBD",
      internship_duration: job.internship_duration || "3 months",
      short_description: job.short_description || "",
      full_description: job.full_description || "",
      role_overview: job.role_overview || "",
      requirementsText: (job.requirements || []).map((x) => `- ${x}`).join("\n") || "- ",
      bonusText: (job.bonus || []).map((x) => `- ${x}`).join("\n") || "- ",
      deadline: job.deadline || "",
      event_date: job.event_date || "",
      application_url: job.application_url || "/quest",
      is_published: job.is_published !== false,
    });
  }

  async function createJob() {
    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const payload = {
        title: jobDraft.title,
        slug: jobDraft.slug,
        type: jobDraft.type,
        team: jobDraft.team,
        employment_type: jobDraft.employment_type,
        work_mode: jobDraft.work_mode,
        location: jobDraft.location || null,
        stipend: jobDraft.stipend,
        internship_duration: jobDraft.internship_duration,
        short_description: jobDraft.short_description,
        full_description: jobDraft.full_description,
        role_overview: jobDraft.role_overview,
        requirements: parseBullets(jobDraft.requirementsText),
        bonus: parseBullets(jobDraft.bonusText),
        deadline: jobDraft.deadline || null,
        event_date: jobDraft.event_date || null,
        application_url: jobDraft.application_url || "/quest",
        is_published: Boolean(jobDraft.is_published),
      };

      await axios.post(`${API}/admin/jobs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadJobs();
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create job";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function updateJob(jobId) {
    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const payload = {
        title: jobDraft.title,
        slug: jobDraft.slug,
        type: jobDraft.type,
        team: jobDraft.team,
        employment_type: jobDraft.employment_type,
        work_mode: jobDraft.work_mode,
        location: jobDraft.location || null,
        stipend: jobDraft.stipend,
        internship_duration: jobDraft.internship_duration,
        short_description: jobDraft.short_description,
        full_description: jobDraft.full_description,
        role_overview: jobDraft.role_overview,
        requirements: parseBullets(jobDraft.requirementsText),
        bonus: parseBullets(jobDraft.bonusText),
        deadline: jobDraft.deadline || null,
        event_date: jobDraft.event_date || null,
        application_url: jobDraft.application_url || "/quest",
        is_published: Boolean(jobDraft.is_published),
      };

      await axios.put(`${API}/admin/jobs/${jobId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadJobs();
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to update job";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function deleteJob(jobId) {
    const ok = window.confirm("Delete this job posting?");
    if (!ok) return;

    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.delete(`${API}/admin/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadJobs();
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to delete job";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

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
    if (!isAuthed) return;
    loadJobs();
    loadApplications();
    // eslint-disable-next-line
  }, [isAuthed]);

  const selectedApplication = appsState.selected;
  const selectedJob = jobsState.selected;

  const downloadResumeHref = useMemo(() => {
    if (!selectedApplication?.id) return null;
    return `${API}/developer-applications/${selectedApplication.id}/resume`;
  }, [selectedApplication?.id]);

  return (
    <div className="quest-page" data-testid="admin-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="admin-backdrop" />

      <main className="quest-container" data-testid="admin-container">
        <a
          href="/"
          className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
          data-testid="admin-pixwik-logo-link"
          aria-label="Pixwik"
        >
          <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="admin-pixwik-logo-img" />
        </a>
        <div className="mb-6" data-testid="admin-header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="admin-title">
                Pixwik Admin
              </h1>
              <p className="text-base md:text-lg text-slate-700" data-testid="admin-subtitle">
                Manage job postings and review applications.
              </p>
            </div>

            {isAuthed ? (
              <Badge variant="secondary" data-testid="admin-auth-badge">
                Logged in
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="admin-auth-badge">
                Not logged in
              </Badge>
            )}
          </div>
        </div>

        {!isAuthed ? (
          <Card className="quest-card" data-testid="admin-login-card">
            <CardHeader>
              <CardTitle data-testid="admin-login-title">Admin Login</CardTitle>
              <CardDescription data-testid="admin-login-desc">Use your Pixwik admin credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {appsState.error ? (
                <div className="quest-error" data-testid="admin-login-error">
                  {appsState.error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-login-fields">
                <div className="space-y-2" data-testid="admin-username-field">
                  <Label htmlFor="adminUser">Username</Label>
                  <Input
                    id="adminUser"
                    value={auth.username}
                    data-testid="admin-username-input"
                    onChange={(e) => setAuth((s) => ({ ...s, username: e.target.value }))}
                    placeholder="pixwikadmin"
                  />
                </div>

                <div className="space-y-2" data-testid="admin-password-field">
                  <Label htmlFor="adminPass">Password</Label>
                  <Input
                    id="adminPass"
                    type="password"
                    value={auth.password}
                    data-testid="admin-password-input"
                    onChange={(e) => setAuth((s) => ({ ...s, password: e.target.value }))}
                    placeholder="••••••••••"
                  />
                </div>
              </div>

              <Button
                className="quest-primary"
                data-testid="admin-login-button"
                onClick={login}
                disabled={appsState.status === "loading"}
              >
                {appsState.status === "loading" ? "Signing in…" : "Sign in"}
              </Button>

              <div className="text-sm text-slate-600" data-testid="admin-security-note">
                Security note: this admin panel is protected by a shared password (MVP). For production, we can upgrade to Google login.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="admin-grid">
            <Card className="quest-card" data-testid="admin-list-card">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle data-testid="admin-list-title">Applications</CardTitle>
                    <CardDescription data-testid="admin-list-desc">Newest first.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2" data-testid="admin-actions">
                    <Button variant="secondary" data-testid="admin-refresh-button" onClick={loadApplications}>
                      Refresh
                    </Button>
                    <Button variant="secondary" data-testid="admin-export-csv-button" onClick={exportApplicationsCsv}>
                      Export CSV
                    </Button>
                  </div>
                </div>

                {appsState.csvUrl ? (
                  <a
                    href={appsState.csvUrl}
                    download={`pixwik-applications-${Date.now()}.csv`}
                    className="quest-link"
                    data-testid="admin-csv-download-link"
                  >
                    Download CSV
                  </a>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-3">
                {appsState.error ? (
                  <div className="quest-error" data-testid="admin-error">
                    {appsState.error}
                  </div>
                ) : null}

                <div className="space-y-2" data-testid="admin-list">
                  {appsState.rows.length === 0 ? (
                    <div className="text-sm text-slate-600" data-testid="admin-empty">
                      No applications yet.
                    </div>
                  ) : null}

                  {appsState.rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`quest-choice ${selectedApplication?.id === r.id ? "quest-choice--active" : ""}`}
                      data-testid={`admin-row-${r.id}`}
                      onClick={() => openApplicationDetails(r.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900" data-testid={`admin-row-name-${r.id}`}>
                            {r.name}
                          </div>
                          <div className="text-sm text-slate-600" data-testid={`admin-row-email-${r.id}`}>
                            {r.email}
                          </div>
                          <div className="text-xs text-slate-500" data-testid={`admin-row-created-${r.id}`}>
                            {formatDate(r.created_at)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="secondary" data-testid={`admin-row-persona-${r.id}`}>
                            {r.persona}
                          </Badge>
                          <Badge variant="secondary" data-testid={`admin-row-xp-${r.id}`}>
                            {r.xp} XP
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="quest-card" data-testid="admin-details-card">
              <CardHeader>
                <CardTitle data-testid="admin-details-title">Details</CardTitle>
                <CardDescription data-testid="admin-details-desc">
                  Open an application to view details and download resume.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedApplication ? (
                  <div className="text-sm text-slate-600" data-testid="admin-details-empty">
                    Select an application from the list.
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="admin-details">
                    <div className="flex flex-wrap items-center gap-2" data-testid="admin-details-badges">
                      <Badge className="quest-badge" data-testid="admin-details-persona">
                        {selectedApplication.persona}
                      </Badge>
                      <Badge variant="secondary" data-testid="admin-details-xp">
                        {selectedApplication.xp} XP
                      </Badge>
                      <Badge variant="secondary" data-testid="admin-details-created">
                        {formatDate(selectedApplication.created_at)}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-details-grid">
                      <div data-testid="admin-details-name">
                        <div className="text-xs text-slate-500">Name</div>
                        <div className="font-medium text-slate-900">{selectedApplication.name}</div>
                      </div>
                      <div data-testid="admin-details-email">
                        <div className="text-xs text-slate-500">Email</div>
                        <div className="font-medium text-slate-900">{selectedApplication.email}</div>
                      </div>
                      <div data-testid="admin-details-phone">
                        <div className="text-xs text-slate-500">Phone</div>
                        <div className="font-medium text-slate-900">{selectedApplication.phone}</div>
                      </div>
                      <div data-testid="admin-details-college">
                        <div className="text-xs text-slate-500">College</div>
                        <div className="font-medium text-slate-900">{selectedApplication.college}</div>
                      </div>
                      <div data-testid="admin-details-grad-year">
                        <div className="text-xs text-slate-500">Grad year</div>
                        <div className="font-medium text-slate-900">{selectedApplication.grad_year}</div>
                      </div>
                      <div data-testid="admin-details-skills">
                        <div className="text-xs text-slate-500">Skills</div>
                        <div className="font-medium text-slate-900">{(selectedApplication.skills || []).join(", ")}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2" data-testid="admin-details-projects">
                      <div className="text-xs text-slate-500">Projects</div>
                      <div className="text-sm text-slate-800 whitespace-pre-wrap">{selectedApplication.projects}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-details-strengths-weaknesses">
                      <div data-testid="admin-details-strengths">
                        <div className="text-xs text-slate-500">Strengths</div>
                        <ul className="list-disc pl-5 text-sm text-slate-800">
                          {(selectedApplication.strengths || []).map((s, idx) => (
                            <li key={`${idx}-${s}`} data-testid={`admin-strength-${idx}`}>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div data-testid="admin-details-weaknesses">
                        <div className="text-xs text-slate-500">Growth zones</div>
                        <ul className="list-disc pl-5 text-sm text-slate-800">
                          {(selectedApplication.weaknesses || []).map((w, idx) => (
                            <li key={`${idx}-${w}`} data-testid={`admin-weakness-${idx}`}>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="admin-details-actions">
                      {downloadResumeHref ? (
                        <a
                          href={downloadResumeHref}
                          target="_blank"
                          rel="noreferrer"
                          className="quest-link"
                          data-testid="admin-resume-download-link"
                        >
                          Download resume
                        </a>
                      ) : null}

                      <div className="text-xs text-slate-500" data-testid="admin-application-id">
                        ID: <span className="font-mono">{selectedApplication.id}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
