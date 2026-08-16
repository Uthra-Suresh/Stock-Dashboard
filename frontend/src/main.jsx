import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Note there is no `import './index.css'` here. Vite's scaffold adds one, and
// its default styles (centered text, dark background, oversized buttons) will
// fight everything in App.css. Delete src/index.css too.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
