import { useState, useEffect } from 'react';

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
