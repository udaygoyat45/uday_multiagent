import { useState, useEffect } from "react";

export function usePolling(url: string, interval: number = 2000) {
  const [status, setStatus] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch data");
        const result = await response.json();

        if (isMounted) {
          setStatus(result.status);
          if (result.status === 5) setError(result.error);
        }
      } catch (err) {
        if (isMounted) setError((err as Error).message);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, interval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [url, interval]);

  return { status, error };
}