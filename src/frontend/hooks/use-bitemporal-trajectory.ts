import { useState, useEffect, useRef } from "react";
import { BitemporalData } from "@/lib/bitemporal-logic";

export function useBitemporalTrajectory(studentId: string, targetTime?: Date | null) {
  const [data, setData] = useState<BitemporalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!studentId) return;

    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);

    fetchTimeout.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let url = `/api/van-hanh/trajectory?studentId=${studentId}`;
        if (targetTime) {
          url += `&targetTime=${targetTime.toISOString()}`;
        }
        
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.ok) {
          setData(json);
        } else {
          setError(json.error?.message || "Lỗi khi tải dữ liệu.");
        }
      } catch (err) {
        console.error(err);
        setError("Lỗi kết nối máy chủ.");
      } finally {
        setLoading(false);
      }
    }, targetTime ? 300 : 0); // Debounce if it's an update, fetch immediately if initial

    return () => {
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    };
  }, [studentId, targetTime]);

  return { data, loading, error };
}
