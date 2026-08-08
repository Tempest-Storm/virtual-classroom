import { useCallback, useEffect, useState } from 'react';

/** Loads data on mount and exposes a manual reload. */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);
  return { data, error, loading, reload: run, setData };
}
