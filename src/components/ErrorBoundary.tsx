import React from 'react';
import { ErrorMessage } from './ErrorMessage';
import { ErrorDetails } from '../utils/errorLogging';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: ErrorDetails | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: any): State {
    return {
      error: {
        message: error?.message || 'An unexpected error occurred',
        timestamp: Date.now()
      }
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log the error to an error reporting service here
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4">
          <ErrorMessage
            message={this.state.error.message}
            consoleOutput={this.state.error.consoleOutput}
          />
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}