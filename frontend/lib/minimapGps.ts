import { useEffect, useState } from "react";

export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface MapPoint {
  x: number; // 0 - 100
  y: number; // 0 - 100
}

export interface ZoneWithGps {
  x: number;
  y: number;
  lat?: number | null;
  lng?: number | null;
}

// Hook lấy GPS thời gian thực của thiết bị
export function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<GpsPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setError(null);
    };

    const handleError = (err: GeolocationPositionError) => {
      setError(err.message);
    };

    // Theo dõi liên tục với độ chính xác cao
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return { position, error };
}

// Tính khoảng cách giữa hai toạ độ GPS bằng công thức Haversine (trả về đơn vị mét)
export function getDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3; // Bán kính Trái Đất (m)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Ánh xạ toạ độ GPS thành toạ độ tương đối (x, y) trên bản đồ dựa trên vị trí GPS của các zone
export function calculateUserMapPosition(
  userGps: GpsPoint | null,
  zones: ZoneWithGps[],
  maxDistanceMeters: number = 1000 // Hạn chế hiển thị nếu người dùng cách xa trên 1km
): MapPoint | null {
  if (!userGps) return null;

  const gpsZones = zones.filter(
    (z): z is ZoneWithGps & { lat: number; lng: number } =>
      z.lat !== null && z.lat !== undefined && z.lng !== null && z.lng !== undefined
  );

  if (gpsZones.length === 0) return null;

  // Tính khoảng cách từ người dùng đến tất cả các zone có GPS
  const zonesWithDist = gpsZones.map((zone) => {
    const dist = getDistanceInMeters(userGps.lat, userGps.lng, zone.lat, zone.lng);
    return { zone, dist };
  });

  // Tìm khoảng cách nhỏ nhất
  const minDist = Math.min(...zonesWithDist.map((d) => d.dist));

  // Nếu quá xa tất cả địa điểm thì coi như ngoài vùng phủ sóng bản đồ
  if (minDist > maxDistanceMeters) {
    return null;
  }

  // Nếu người dùng đang đứng rất sát một zone (< 2m), trả về toạ độ của zone đó luôn
  const veryCloseZone = zonesWithDist.find((d) => d.dist < 2);
  if (veryCloseZone) {
    return { x: veryCloseZone.zone.x, y: veryCloseZone.zone.y };
  }

  // Nếu chỉ có 1 zone được cấu hình GPS, chỉ có thể coi toạ độ map trùng với zone đó
  if (gpsZones.length === 1) {
    return { x: gpsZones[0].x, y: gpsZones[0].y };
  }

  // Nội suy bằng thuật toán Inverse Distance Weighting (IDW) lũy thừa p = 2
  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;

  for (const { zone, dist } of zonesWithDist) {
    const d = Math.max(dist, 0.1); // Tránh chia cho 0
    const weight = 1 / (d * d);
    sumWeight += weight;
    sumX += zone.x * weight;
    sumY += zone.y * weight;
  }

  if (sumWeight === 0) return null;

  let x = sumX / sumWeight;
  let y = sumY / sumWeight;

  // Đảm bảo toạ độ nằm trong biên ảnh [0%, 100%]
  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));

  return { x, y };
}
