import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { store } from "./app/store";
import { SmartPopupProvider } from "./components/SmartPopupProvider";
import { registerServiceWorker } from "./utils/pwa";
import "./print.css";
import "./styles.css";

// Register service worker for PWA functionality
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SmartPopupProvider>
          <App />
        </SmartPopupProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
