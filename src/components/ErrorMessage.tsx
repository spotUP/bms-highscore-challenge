import React from 'react';

interface ErrorMessageProps {
  message: string;
  consoleOutput?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, consoleOutput }) => {
  const copyToClipboard = async () => {
    const textToCopy = `Error Message: ${message}\n${consoleOutput ? `\nConsole Output:\n${consoleOutput}` : ''}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      // Optional: Add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="error-message-container bg-red-50 border border-red-200 rounded-md p-4 relative">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-red-700">{message}</p>
          {consoleOutput && (
            <pre className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
              {consoleOutput}
            </pre>
          )}
        </div>
        <button
          onClick={copyToClipboard}
          className="ml-4 p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          title="Copy error details"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};