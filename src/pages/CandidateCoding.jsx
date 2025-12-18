import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";

import PixwikLogo from "@/assets/pixwik-logo.svg";
import { API, getAxiosConfig, extractErrorMessage } from "@/config/api";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const [compilerCode, setCompilerCode] = useState("");
  const [compilerOutput, setCompilerOutput] = useState("");
  const [compilerRunning, setCompilerRunning] = useState(false);

  // Ref for compiler iframe
  const compilerIframeRef = useRef(null);

  // Mobile warning modal state
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  // Check screen size and show warning on mobile
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 1024) {
        setShowMobileWarning(true);
      } else {
        setShowMobileWarning(false);
      }
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);


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
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        });
        if (!mounted) return;

        const problem = res.data.problem;
        setState({ status: "ready", error: null, round: res.data.round, problem });

        // Initialize starter code based on language
        setCode(problem?.starter_python || "");
        setLanguage("python");
      } catch (e) {
        const msg = extractErrorMessage(e, "Failed to load coding task");
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
    if (!state.problem) return { python: "", javascript: "", c: "", java: "" };
    return {
      python: state.problem.starter_python || "",
      javascript: state.problem.starter_javascript || "",
      c: state.problem.starter_c || "",
      java: state.problem.starter_java || "",
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
      const msg = extractErrorMessage(e, "Run failed");
      setRunState({ status: "error", error: msg, result: null });
    }
  }

  // Function to extract code from OneCompiler iframe
  async function getCodeFromCompiler() {
    try {
      // Find the active iframe based on current language
      let iframe = compilerIframeRef.current;

      // If ref is not set, try to find iframe by data-testid
      if (!iframe) {
        const testIds = {
          javascript: "candidate-coding-compiler-javascript",
          python: "candidate-coding-compiler-python",
          c: "candidate-coding-compiler-c",
          java: "candidate-coding-compiler-java"
        };
        const testId = testIds[language];
        if (testId) {
          const iframeElement = document.querySelector(`[data-testid="${testId}"]`);
          if (iframeElement) {
            iframe = iframeElement;
          }
        }
      }

      if (!iframe) {
        console.log("No iframe reference found");
        return null;
      }
      const iframeWindow = iframe.contentWindow;

      if (!iframeWindow) {
        console.log("Iframe window not accessible");
        return null;
      }

      // Try to access iframe document directly (may fail due to CORS)
      try {
        const iframeDocument = iframe.contentDocument || iframeWindow.document;

        if (iframeDocument) {
          console.log("✓ Iframe document accessible, searching for editor...");

          // Try multiple selectors to find the editor (OneCompiler specific)
          const selectors = [
            'textarea[class*="editor"]',
            'textarea[class*="code"]',
            'textarea[class*="CodeMirror"]',
            '.CodeMirror textarea',
            '.CodeMirror-code',
            '.monaco-editor textarea',
            '.monaco-editor .view-lines',
            'textarea',
            '[contenteditable="true"][class*="editor"]',
            '[contenteditable="true"][class*="code"]',
            '[data-code]',
            '[id*="code"]',
            '[id*="editor"]',
            '[class*="code-editor"]',
            '[class*="editor-container"]',
            'pre[class*="code"]',
            'code',
            'textarea:not([type="hidden"])',
            '[contenteditable="true"]'
          ];

          for (const selector of selectors) {
            try {
              const editor = iframeDocument.querySelector(selector);
              if (editor) {
                console.log(`Found editor with selector: ${selector}`);

                // For CodeMirror
                if (editor.CodeMirror) {
                  const code = editor.CodeMirror.getValue();
                  if (code && code.trim()) {
                    console.log("✓ Code extracted via CodeMirror");
                    return code;
                  }
                }

                // For Monaco Editor (access via iframe window)
                if (iframeWindow.monaco && iframeWindow.monaco.editor) {
                  try {
                    const models = iframeWindow.monaco.editor.getModels();
                    if (models && models.length > 0) {
                      const code = models[0].getValue();
                      if (code && code.trim()) {
                        console.log("✓ Code extracted via Monaco Editor");
                        return code;
                      }
                    }
                  } catch (e) {
                    console.log("Monaco access failed:", e);
                  }
                }

                // For regular textarea
                if (editor.tagName === 'TEXTAREA' && editor.value) {
                  const code = editor.value;
                  if (code && code.trim()) {
                    console.log("✓ Code extracted via textarea value");
                    return code;
                  }
                }

                // For contenteditable divs
                const code = editor.textContent || editor.innerText || editor.value;
                if (code && code.trim()) {
                  console.log("✓ Code extracted via textContent/innerText");
                  return code;
                }
              }
            } catch (selectorError) {
              continue;
            }
          }

          // Try to get all textareas and check their values
          const allTextareas = iframeDocument.querySelectorAll('textarea');
          for (const textarea of allTextareas) {
            if (textarea.value && textarea.value.trim()) {
              console.log("✓ Code extracted from textarea collection");
              return textarea.value;
            }
          }
        }
      } catch (corsError) {
        console.log("⚠ Direct iframe access blocked by CORS:", corsError.message);
      }

      // Use postMessage to request code from OneCompiler
      console.log("Attempting postMessage communication...");
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(null);
        }, 2000);

        const handleMessage = (event) => {
          if (event.origin.includes('onecompiler.com')) {
            if (event.data && (event.data.code || event.data.content)) {
              clearTimeout(timeout);
              window.removeEventListener('message', handleMessage);
              const code = event.data.code || event.data.content;
              console.log("✓ Code received via postMessage");
              resolve(code);
            }
          }
        };

        window.addEventListener('message', handleMessage);

        // Send postMessage request
        iframeWindow.postMessage({ type: 'getCode', action: 'getEditorContent' }, '*');
      });
    } catch (error) {
      console.error("Error accessing iframe content:", error);
      return null;
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

  async function runCompiler() {
    setCompilerRunning(true);
    setCompilerOutput("");

    try {
      if (language === "javascript") {
        // Run JavaScript in browser
        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
          logs.push(args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)).join(" "));
          originalLog.apply(console, args);
        };

        console.error = (...args) => {
          logs.push("ERROR: " + args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)).join(" "));
          originalError.apply(console, args);
        };

        console.warn = (...args) => {
          logs.push("WARN: " + args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)).join(" "));
          originalWarn.apply(console, args);
        };

        // Execute the code
        const result = eval(compilerCode);

        // Restore original console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;

        // Display output
        let output = logs.join("\n");
        if (result !== undefined && result !== null) {
          if (output) output += "\n";
          output += "Result: " + (typeof result === "object" ? JSON.stringify(result, null, 2) : String(result));
        }
        setCompilerOutput(output || "Code executed successfully (no output)");
      } else {
        // For Python, C, and Java, use API to run code
        const res = await axios.post(
          `${API}/candidate/coding/run`,
          { language, code: compilerCode },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.data.output) {
          setCompilerOutput(res.data.output);
        } else if (res.data.error) {
          setCompilerOutput(`Error: ${res.data.error}`);
        } else {
          setCompilerOutput("Code executed successfully");
        }
      }
    } catch (error) {
      setCompilerOutput(`Error: ${error.message}\n${error.response?.data?.error || error.stack || ""}`);
    } finally {
      setCompilerRunning(false);
    }
  }

  return (
    <div className="quest-page" data-testid="candidate-coding-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="candidate-coding-backdrop" />

      {showMobileWarning && (
        <style>{`
          [data-radix-dialog-overlay] {
            background-color: rgb(0, 0, 0) !important;
            opacity: 1 !important;
          }
        `}</style>
      )}
      <Dialog open={showMobileWarning} onOpenChange={(open) => {
        // Prevent closing the modal on mobile - it should stay open
        if (!open && window.innerWidth < 1024) {
          setShowMobileWarning(true);
        } else {
          setShowMobileWarning(open);
        }
      }}>
        <DialogContent className="max-w-md" data-testid="candidate-coding-mobile-warning-dialog" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle data-testid="candidate-coding-mobile-warning-title test-center">Desktop Required</DialogTitle>
            <DialogDescription data-testid="candidate-coding-mobile-warning-desc">
              This screen is only for desktops. Please open this page on a desktop or laptop computer for the best experience.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 text-center">
              The coding task interface requires a larger screen to function properly.
            </p>
          </div>
          <div className="flex justify-end">
            {/* <Button
              variant="secondary"
              onClick={() => {
                // Still prevent closing on mobile
                if (window.innerWidth >= 1024) {
                  setShowMobileWarning(false);
                }
              }}
              data-testid="candidate-coding-mobile-warning-close"
            >
              I Understand
            </Button> */}
          </div>
        </DialogContent>
      </Dialog>

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
          <div className="quest-warning text-center f-14 text-success" data-testid="candidate-coding-error">{extractErrorMessage(state.error)}</div>
        ) : null}

        {state.status === "ready" && state.problem ? (
          <div className="grid-cols-1 lg:grid-cols-3 gap-6 w-100" data-testid="candidate-coding-grid">
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
                      <SelectItem value="c" data-testid="candidate-coding-language-c">C</SelectItem>
                      <SelectItem value="java" data-testid="candidate-coding-language-java">Java</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* <div className="flex flex-wrap items-center gap-2" data-testid="candidate-coding-actions">
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
                </div> */}

                {runState.error ? (
                  <div className="quest-error" data-testid="candidate-coding-run-error">{extractErrorMessage(runState.error)}</div>
                ) : null}

                {runState.result ? (
                  <div className="quest-hint" data-testid="candidate-coding-run-result">
                    Passed {runState.result.passed}/{runState.result.total} tests
                  </div>
                ) : null}
              </CardContent>
            </Card>


          </div>
        ) : null}

        {state.status === "ready" && (
          <div className="mt-6" data-testid="candidate-coding-compiler">
            <Card className="quest-card">
              <CardHeader>
                <CardTitle data-testid="candidate-coding-compiler-title">
                  {language === "javascript" ? "JavaScript" : language === "python" ? "Python" : language === "c" ? "C" : "Java"} Online Compiler
                </CardTitle>
                <CardDescription data-testid="candidate-coding-compiler-desc">
                  Test and run {language === "javascript" ? "JavaScript" : language === "python" ? "Python" : language === "c" ? "C" : "Java"} code in real-time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-slate-200/70" style={{ height: "600px" }}>
                  {language === "javascript" && (
                    <iframe
                      ref={compilerIframeRef}
                      src="https://onecompiler.com/embed/javascript?hideLanguageSelection=true&hideNew=true&hideNewFileOption=true&hideTitle=true"
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "0",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                      title="JavaScript Online Compiler - OneCompiler"
                      allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                      data-testid="candidate-coding-compiler-javascript"
                    />
                  )}
                  {language === "python" && (
                    <iframe
                      ref={compilerIframeRef}
                      src="https://onecompiler.com/embed/python?hideLanguageSelection=true&hideNew=true&hideNewFileOption=true&hideTitle=true"
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "0",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                      title="Python Online Compiler - OneCompiler"
                      allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                      data-testid="candidate-coding-compiler-python"
                    />
                  )}
                  {language === "c" && (
                    <iframe
                      ref={compilerIframeRef}
                      src="https://onecompiler.com/embed/c?hideLanguageSelection=true&hideNew=true&hideNewFileOption=true&hideTitle=true"
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "0",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                      title="C Online Compiler - OneCompiler"
                      allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                      data-testid="candidate-coding-compiler-c"
                    />
                  )}
                  {language === "java" && (
                    <iframe
                      ref={compilerIframeRef}
                      src="https://onecompiler.com/embed/java?hideLanguageSelection=true&hideNew=true&hideNewFileOption=true&hideTitle=true"
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "0",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                      title="Java Online Compiler - OneCompiler"
                      allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                      data-testid="candidate-coding-compiler-java"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {state.status === "ready" && (
          <div>
          <Card className="quest-card lg:col-span-2" data-testid="candidate-coding-editor-card">
            <CardHeader>
              <CardTitle data-testid="candidate-coding-editor-title">Save Code :</CardTitle>
              <CardDescription data-testid="candidate-coding-editor-desc">
                Tip: Save your code to your account.
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
            </CardContent>
            <div className="flex justify-end m-4" >
            <button className="quest-primary f-14 p-2 text-white" data-testid="candidate-coding-submit-button" onClick={submit}>Submit</button>
          </div>
          </Card>
         
          </div>
        )}
     
      </main>

      <div>
        
      </div>
    </div>
    
  );
}
