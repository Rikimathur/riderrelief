export type UserRole = 'worker' | 'admin';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type NetworkQuality = 'good' | 'fair' | 'poor';
export type WeatherType = 'storm' | 'flood' | 'extreme_heat';

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
  zone?: string;
  activeHours?: {
    start: string;
    end: string;
  };
  status?: 'active' | 'inactive';
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: number;
  };
  updatedAt?: string;
}

export interface Claim {
  id: string;
  workerUid: string;
  weatherEventId?: string;
  status: ClaimStatus;
  amount: number;
  timestamp: string;
  verificationScore?: number;
  layers?: {
    behavioral?: number;
    sensorFusion?: number;
    weatherCorrelation?: number;
    crowdValidation?: number;
  };
}

export interface SensorLog {
  id: string;
  workerUid: string;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
  };
  accelerometer?: {
    x: number;
    y: number;
    z: number;
  };
  gyroscope?: {
    x: number;
    y: number;
    z: number;
  };
  networkQuality?: NetworkQuality;
}

export interface WeatherEvent {
  id: string;
  zone: string;
  severity: string;
  timestamp: string;
  type: WeatherType;
}
