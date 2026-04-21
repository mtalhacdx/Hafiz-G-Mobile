import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { prefetchAllData } from "../api/dataPrefetch";

const DataBootstrapper = ({ children }) => {
  const token = useSelector((state) => state.auth.token);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      startedRef.current = false;
      return;
    }

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    prefetchAllData().catch(() => {
      // Status is updated inside prefetchAllData.
    });
  }, [token]);

  return children;
};

export default DataBootstrapper;
