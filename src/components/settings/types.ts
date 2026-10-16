/** Tipe baris log untuk komponen klien Pengaturan (tanggal sudah diformat). */

export type LoginLogRow = {
  id: number;
  email: string;
  success: boolean;
  method: string;
  ip: string | null;
  message: string | null;
  createdAt: string;
};

export type ActivityLogRow = {
  id: number;
  userName: string | null;
  action: string;
  entity: string | null;
  detail: string | null;
  createdAt: string;
};
