import { Component, lazy, Suspense, type ReactNode } from 'react';
import { usePath } from './lib/router.ts';
import { Spinner, Toaster } from './components/ui.tsx';
import { Landing } from './screens/Landing.tsx';

// Code-split so attendees don't download the organizer dashboard and vice versa.
const EventFlow = lazy(() => import('./screens/EventFlow.tsx'));
const OrganizerCreate = lazy(() => import('./organizer/OrganizerCreate.tsx'));
const Dashboard = lazy(() => import('./organizer/Dashboard.tsx'));

export function App() {
  const path = usePath().split('?')[0];
  let page: ReactNode;
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/e\/([a-z0-9-]{3,40})\/?$/))) page = <EventFlow eventId={m[1]} />;
  else if (path === '/organize' || path === '/organize/') page = <OrganizerCreate />;
  else if ((m = path.match(/^\/organize\/([a-z0-9-]{3,40})\/?$/))) page = <Dashboard eventId={m[1]} />;
  else page = <Landing />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<FullLoader />}>{page}</Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}

export function FullLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-dvh grid place-items-center text-ink-mute">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="text-ink" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-5xl mb-4" aria-hidden="true">🧸</div>
          <h1 className="text-2xl font-bold mb-2">Our toy tripped over</h1>
          <p className="text-ink-mute mb-6">Something went wrong on this screen. Reloading usually fixes it — you’ll keep your toy.</p>
          <button className="btn-primary btn-lg" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
