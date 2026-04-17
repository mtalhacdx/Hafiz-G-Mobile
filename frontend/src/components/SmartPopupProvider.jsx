import { createContext, useContext, useMemo, useState } from "react";

const SmartPopupContext = createContext(null);

const buildDefaultState = () => ({
  open: false,
  mode: "confirm",
  title: "",
  message: "",
  confirmText: "OK",
  cancelText: "Cancel",
  placeholder: "",
  value: "",
  inputType: "text",
  inputOptions: [],
  min: undefined,
  max: undefined,
  step: undefined,
  required: false,
  errorText: "",
  validate: null,
  resolver: null,
});

const SmartPopupProvider = ({ children }) => {
  const [state, setState] = useState(buildDefaultState());

  const closeWith = (result) => {
    if (state.resolver) {
      state.resolver(result);
    }
    setState(buildDefaultState());
  };

  const api = useMemo(
    () => ({
      confirm(options) {
        return new Promise((resolve) => {
          setState({
            open: true,
            mode: "confirm",
            title: options?.title || "Please Confirm",
            message: options?.message || "Are you sure?",
            confirmText: options?.confirmText || "Confirm",
            cancelText: options?.cancelText || "Cancel",
            placeholder: "",
            value: "",
            inputType: "text",
            inputOptions: [],
            min: undefined,
            max: undefined,
            step: undefined,
            required: false,
            errorText: "",
            validate: null,
            resolver: resolve,
          });
        });
      },
      prompt(options) {
        return new Promise((resolve) => {
          setState({
            open: true,
            mode: "prompt",
            title: options?.title || "Enter Value",
            message: options?.message || "Provide input",
            confirmText: options?.confirmText || "Submit",
            cancelText: options?.cancelText || "Cancel",
            placeholder: options?.placeholder || "",
            value: options?.initialValue !== undefined ? String(options.initialValue) : "",
            inputType: options?.inputType || "text",
            inputOptions: Array.isArray(options?.inputOptions) ? options.inputOptions : [],
            min: options?.min,
            max: options?.max,
            step: options?.step,
            required: options?.required === true,
            errorText: "",
            validate: typeof options?.validate === "function" ? options.validate : null,
            resolver: resolve,
          });
        });
      },
      alert(options) {
        return new Promise((resolve) => {
          setState({
            open: true,
            mode: "alert",
            title: options?.title || "Notice",
            message: options?.message || "",
            confirmText: options?.confirmText || "OK",
            cancelText: "",
            placeholder: "",
            value: "",
            inputType: "text",
            inputOptions: [],
            min: undefined,
            max: undefined,
            step: undefined,
            required: false,
            errorText: "",
            validate: null,
            resolver: () => resolve(),
          });
        });
      },
    }),
    []
  );

  const onBackdropClick = () => {
    if (state.mode === "alert") {
      closeWith(undefined);
      return;
    }

    closeWith(state.mode === "prompt" ? null : false);
  };

  return (
    <SmartPopupContext.Provider value={api}>
      {children}

      {state.open ? (
        <div className="smart-popup-wrap" role="dialog" aria-modal="true">
          <button
            type="button"
            className="smart-popup-backdrop"
            aria-label="Close popup"
            onClick={onBackdropClick}
          />

          <section className="smart-popup-card">
            <h3>{state.title}</h3>
            <p>{state.message}</p>

            {state.mode === "prompt" && state.inputType === "select" ? (
              <select
                autoFocus
                value={state.value}
                onChange={(event) => {
                  setState((prev) => ({ ...prev, value: event.target.value, errorText: "" }));
                }}
              >
                {state.inputOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}

            {state.mode === "prompt" && state.inputType !== "select" ? (
              <input
                autoFocus
                type={state.inputType}
                value={state.value}
                placeholder={state.placeholder}
                min={state.min}
                max={state.max}
                step={state.step}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (state.inputType === "number") {
                    if (nextValue === "") {
                      setState((prev) => ({ ...prev, value: "", errorText: "" }));
                      return;
                    }

                    const asNumber = Number(nextValue);

                    if (!Number.isFinite(asNumber)) {
                      setState((prev) => ({ ...prev, value: nextValue, errorText: "Enter a valid number" }));
                      return;
                    }

                    if (state.max !== undefined && asNumber > Number(state.max)) {
                      setState((prev) => ({
                        ...prev,
                        value: String(state.max),
                        errorText: `Maximum allowed is ${state.max}`,
                      }));
                      return;
                    }

                    if (state.min !== undefined && asNumber < Number(state.min)) {
                      setState((prev) => ({ ...prev, value: nextValue, errorText: "" }));
                      return;
                    }
                  }

                  setState((prev) => ({ ...prev, value: nextValue, errorText: "" }));
                }}
              />
            ) : null}

            {state.mode === "prompt" && state.errorText ? (
              <p className="smart-popup-error">{state.errorText}</p>
            ) : null}

            <div className="smart-popup-actions">
              {state.mode !== "alert" ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => closeWith(state.mode === "prompt" ? null : false)}
                >
                  {state.cancelText}
                </button>
              ) : null}

              <button
                type="button"
                className={state.mode === "alert" ? "ghost-btn" : "primary-btn"}
                onClick={() => {
                  if (state.mode === "prompt") {
                    const trimmedValue = String(state.value || "").trim();

                    if (state.required && !trimmedValue) {
                      setState((prev) => ({ ...prev, errorText: "This field is required" }));
                      return;
                    }

                    if (state.inputType === "number" && trimmedValue) {
                      const asNumber = Number(trimmedValue);

                      if (!Number.isFinite(asNumber)) {
                        setState((prev) => ({ ...prev, errorText: "Enter a valid number" }));
                        return;
                      }

                      if (state.min !== undefined && asNumber < Number(state.min)) {
                        setState((prev) => ({ ...prev, errorText: `Minimum allowed is ${state.min}` }));
                        return;
                      }

                      if (state.max !== undefined && asNumber > Number(state.max)) {
                        setState((prev) => ({ ...prev, errorText: `Maximum allowed is ${state.max}` }));
                        return;
                      }
                    }

                    if (state.validate) {
                      const customError = state.validate(trimmedValue);
                      if (customError) {
                        setState((prev) => ({ ...prev, errorText: String(customError) }));
                        return;
                      }
                    }

                    closeWith(state.value);
                    return;
                  }

                  closeWith(state.mode === "alert" ? undefined : true);
                }}
              >
                {state.confirmText}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </SmartPopupContext.Provider>
  );
};

const useSmartPopup = () => {
  const ctx = useContext(SmartPopupContext);
  if (!ctx) {
    throw new Error("useSmartPopup must be used within SmartPopupProvider");
  }
  return ctx;
};

export { SmartPopupProvider, useSmartPopup };
