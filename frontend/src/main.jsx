import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { store } from "./app/store";
import { SmartPopupProvider } from "./components/SmartPopupProvider";
import "./print.css";
import "./styles.css";

import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    console.log("New content available");
  },
  onOfflineReady() {
    console.log("App ready offline");
  },
});

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
