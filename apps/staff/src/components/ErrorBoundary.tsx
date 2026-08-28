import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Last-resort safety net: if anything in the tree throws during render
// (not just chunk-load failures, which are handled separately in main.tsx
// via the vite:preloadError listener), this turns what would otherwise be
// a genuinely blank white screen into a page with an actual message and a
// way out, instead of leaving the person staring at nothing with no clue
// what happened.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Uncaught render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-forest-950 px-4">
          <div className="w-full max-w-sm bg-forest-900 p-8 rounded-lg space-y-3 text-center">
            <h1 className="font-display text-lg text-forest-100">Something went wrong</h1>
            <p className="font-ui text-sm text-forest-300">
              Try reloading the page. If this keeps happening, try a different browser or network.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full p-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
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
