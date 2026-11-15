import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Employee, Role } from "@/types";
import { getDb } from "@/services/database";

interface AuthState {
  currentEmployee: Employee | null;
  isUnlocking: boolean;
  error: string | null;
  loginWithPin: (employeeId: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  /** First-run only: creates the admin account and logs in. */
  createOwner: (name: string, pin: string) => Promise<boolean>;
  /** Re-reads the logged-in employee from DB (after the profile was edited). */
  refreshCurrent: () => Promise<void>;
  hasPermission: (requiredRoles: Role[]) => boolean;
}

const SESSION_KEY = "salonpos.session.employeeId";

// In production, swap for expo-crypto's digestStringAsync (SHA-256).
// Kept dependency-free here so the skill package list stays minimal;
// see README "Security hardening" for the swap-in snippet.
export async function hashPin(pin: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash |= 0;
  }
  return `v1:${hash}`;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentEmployee: null,
  isUnlocking: false,
  error: null,

  async loginWithPin(employeeId, pin) {
    set({ isUnlocking: true, error: null });
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{
        id: string;
        name: string;
        role: Role;
        pin_hash: string;
        default_commission_basis: "percent" | "fixed";
        default_commission_value: number;
        active: number;
      }>("SELECT * FROM employees WHERE id = ? AND active = 1", [employeeId]);

      if (!row) {
        set({ error: "Karyawan tidak ditemukan atau nonaktif", isUnlocking: false });
        return false;
      }
      const pinHash = await hashPin(pin);
      if (pinHash !== row.pin_hash) {
        set({ error: "PIN salah", isUnlocking: false });
        return false;
      }

      const employee: Employee = {
        id: row.id,
        name: row.name,
        role: row.role,
        pinHash: row.pin_hash,
        defaultCommissionBasis: row.default_commission_basis,
        defaultCommissionValue: row.default_commission_value,
        active: !!row.active,
      };
      await AsyncStorage.setItem(SESSION_KEY, employee.id);
      set({ currentEmployee: employee, isUnlocking: false, error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Login gagal", isUnlocking: false });
      return false;
    }
  },

  async logout() {
    await AsyncStorage.removeItem(SESSION_KEY);
    set({ currentEmployee: null });
  },

  async restoreSession() {
    const employeeId = await AsyncStorage.getItem(SESSION_KEY);
    if (!employeeId) return;
    const db = await getDb();
    const row = await db.getFirstAsync<any>("SELECT * FROM employees WHERE id = ? AND active = 1", [employeeId]);
    if (!row) return;
    set({
      currentEmployee: {
        id: row.id,
        name: row.name,
        role: row.role,
        pinHash: row.pin_hash,
        defaultCommissionBasis: row.default_commission_basis,
        defaultCommissionValue: row.default_commission_value,
        active: !!row.active,
      },
    });
  },

  async createOwner(name, pin) {
    set({ isUnlocking: true, error: null });
    try {
      const db = await getDb();
      const existing = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM employees");
      if (existing && existing.cnt > 0) {
        set({ error: "Owner sudah dibuat", isUnlocking: false });
        return false;
      }
      const id = `owner-${Date.now()}`;
      const pinHash = await hashPin(pin);
      await db.runAsync(
        `INSERT INTO employees (id, name, role, pin_hash, default_commission_basis, default_commission_value, active)
         VALUES (?,?,?,?,?,?,1)`,
        [id, name.trim(), "admin", pinHash, "percent", 0]
      );
      await AsyncStorage.setItem(SESSION_KEY, id);
      set({
        currentEmployee: {
          id,
          name: name.trim(),
          role: "admin",
          pinHash,
          defaultCommissionBasis: "percent",
          defaultCommissionValue: 0,
          active: true,
        },
        isUnlocking: false,
        error: null,
      });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Gagal membuat owner", isUnlocking: false });
      return false;
    }
  },

  async refreshCurrent() {
    const id = get().currentEmployee?.id;
    if (!id) return;
    const db = await getDb();
    const row = await db.getFirstAsync<any>("SELECT * FROM employees WHERE id = ?", [id]);
    if (!row) return;
    set({
      currentEmployee: {
        id: row.id,
        name: row.name,
        role: row.role,
        pinHash: row.pin_hash,
        defaultCommissionBasis: row.default_commission_basis,
        defaultCommissionValue: row.default_commission_value,
        active: !!row.active,
      },
    });
  },

  hasPermission(requiredRoles) {
    const emp = get().currentEmployee;
    if (!emp) return false;
    return requiredRoles.includes(emp.role);
  },
}));

/** RBAC matrix — single source of truth for which role can reach which module. */
export const PERMISSIONS = {
  pos: ["admin", "kasir"] as Role[],
  booking: ["admin", "kasir", "stylist"] as Role[],
  membership: ["admin", "kasir"] as Role[],
  finance: ["admin"] as Role[],
  inventory: ["admin", "kasir"] as Role[],
  services: ["admin"] as Role[],
  printer: ["admin", "kasir"] as Role[],
  employees: ["admin"] as Role[],
  settings: ["admin"] as Role[],
  /** Riwayat transaksi: lihat dan cetak ulang struk. */
  history: ["admin", "kasir"] as Role[],
  /** Koreksi transaksi yang sudah tercatat. Tambahkan "kasir" di sini bila kasir boleh mengedit. */
  transactionEdit: ["admin"] as Role[],
};
