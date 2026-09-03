import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// See apps/staff and apps/student-parent's ErrorBoundary for the full
// rationale -- last-resort safety net turning an uncaught render error
// into a page with an actual message instead of a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Uncaught render error:", error);
    Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
          <div className="w-full max-w-sm bg-slate-900 p-8 rounded-lg space-y-3 text-center border border-slate-700">
            <h1 className="font-display text-lg text-slate-100">Something went wrong</h1>
            <p className="font-body text-sm text-slate-300">
              Try reloading the page. If this keeps happening, try a different browser or network.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full p-2 rounded bg-amber-500 text-slate-950 font-ui font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
