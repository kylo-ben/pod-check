import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { inject } from "@vercel/analytics";
import * as Sentry from "@sentry/react";
import { browserTracingIntegration } from "@sentry/react";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import App from "./App.jsx";

Sentry.init({
  dsn: "https://b36a7c2092f16303f53c93721f4d6fd4@o4511187779584000.ingest.us.sentry.io/4511187781550080",
  integrations: [browserTracingIntegration()],
  tracesSampleRate: 0.2,
  environment: import.meta.env.MODE,
});

inject();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);