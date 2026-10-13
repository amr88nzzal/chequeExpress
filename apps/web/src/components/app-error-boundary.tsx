import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from './pages/error-page';

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort boundary: a rendering crash shows the localised error page instead
 * of a blank screen. It is a class because React has no hook equivalent.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The real app forwards this to the server logger with the requestId.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorPage onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
