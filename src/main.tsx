import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getDb } from "./lib/db";

// Initialize DB on startup
getDb().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
