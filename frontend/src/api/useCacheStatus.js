import { useEffect, useState } from "react";
import { getCacheStatus, subscribeCacheStatus } from "./cacheStore";

const useCacheStatus = () => {
  const [status, setStatus] = useState(() => getCacheStatus());

  useEffect(() => {
    return subscribeCacheStatus((next) => {
      setStatus(next);
    });
  }, []);

  return status;
};

export default useCacheStatus;
