import { useCallback, useState } from "react";

const useToastMessage = () => {
  const [noticeState, setNoticeState] = useState({ text: "", key: 0 });
  const [errorState, setErrorState] = useState({ text: "", key: 0 });

  const setNotice = useCallback((value) => {
    setNoticeState((prev) => ({
      text: typeof value === "function" ? value(prev.text) : String(value || ""),
      key: prev.key + 1,
    }));
  }, []);

  const setError = useCallback((value) => {
    setErrorState((prev) => ({
      text: typeof value === "function" ? value(prev.text) : String(value || ""),
      key: prev.key + 1,
    }));
  }, []);

  return {
    notice: noticeState.text,
    noticeKey: noticeState.key,
    error: errorState.text,
    errorKey: errorState.key,
    setNotice,
    setError,
  };
};

export default useToastMessage;
