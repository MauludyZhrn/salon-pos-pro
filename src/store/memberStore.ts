import { create } from "zustand";
import { getDb, withTransaction } from "@/services/database";
import { newId } from "@/utils/id";
import { FREE_TREATMENT_POINTS, POINTS_PER_TREATMENT } from "@/utils/membership";
import type { Member, MemberPointLog } from "@/types";

function rowToMember(row: any): Member {
  return {
    id: row.id,
    memberCode: row.member_code,
    name: row.name,
    phone: row.phone ?? null,
    points: Number(row.points) || 0,
    totalTreatments: Number(row.total_treatments) || 0,
    totalRedeemed: Number(row.total_redeemed) || 0,
    notes: row.notes ?? null,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLog(row: any): MemberPointLog {
  return {
    id: row.id,
    memberId: row.member_id,
    transactionLocalId: row.transaction_local_id ?? null,
    type: row.type,
    pointsDelta: Number(row.points_delta) || 0,
    treatmentsCount: Number(row.treatments_count) || 0,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

async function nextMemberCode(): Promise<string> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ member_code: string }>("SELECT member_code FROM members");
  let max = 0;
  for (const r of rows) {
    const match = /^MBR-(\d+)$/i.exec(r.member_code ?? "");
    if (match) {
      const n = Number(match[1]);
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return `MBR-${String(max + 1).padStart(4, "0")}`;
}

export interface MemberInput {
  name: string;
  phone: string | null;
  points: number;
  notes: string | null;
  active: boolean;
}

interface MemberState {
  members: Member[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (input: MemberInput, id?: string) => Promise<Member>;
  remove: (id: string) => Promise<void>;
  /** Tambah poin dari N kali treatment (1x treatment = +10 poin). */
  addTreatmentPoints: (memberId: string, treatmentsCount?: number, note?: string) => Promise<void>;
  /** Klaim 1x Gratis Treatment (-100 poin). */
  redeemFreeTreatment: (memberId: string, note?: string) => Promise<void>;
  getLogs: (memberId: string) => Promise<MemberPointLog[]>;
}

export const useMemberStore = create<MemberState>((set, get) => ({
  members: [],
  loaded: false,

  async load() {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM members ORDER BY active DESC, points DESC, name ASC");
    set({ members: rows.map(rowToMember), loaded: true });
  },

  async save(input, id) {
    const now = new Date().toISOString();
    let savedId = id ?? newId();

    await withTransaction(async (db) => {
      if (id) {
        const prev = await db.getFirstAsync<{ points: number }>("SELECT points FROM members WHERE id = ?", [id]);
        const prevPoints = Number(prev?.points) || 0;
        const delta = input.points - prevPoints;

        await db.runAsync(
          `UPDATE members
              SET name = ?, phone = ?, points = ?, notes = ?, active = ?, updated_at = ?
            WHERE id = ?`,
          [input.name.trim(), input.phone, input.points, input.notes, input.active ? 1 : 0, now, id]
        );

        if (delta !== 0) {
          await db.runAsync(
            `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
             VALUES (?,?,NULL,'adjust',?,0,?,?)`,
            [newId(), id, delta, "Penyesuaian poin manual", now]
          );
        }
      } else {
        const code = await nextMemberCode();
        const initialTreatments = Math.floor(Math.max(0, input.points) / POINTS_PER_TREATMENT);
        await db.runAsync(
          `INSERT INTO members (id, member_code, name, phone, points, total_treatments, total_redeemed, notes, active, created_at, updated_at)
           VALUES (?,?,?,?,?,?,0,?,?,?,?)`,
          [
            savedId,
            code,
            input.name.trim(),
            input.phone,
            input.points,
            initialTreatments,
            input.notes,
            input.active ? 1 : 0,
            now,
            now,
          ]
        );

        if (input.points > 0) {
          await db.runAsync(
            `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
             VALUES (?,?,NULL,'earn',?,?,?,?)`,
            [newId(), savedId, input.points, initialTreatments, `Saldo poin awal (${initialTreatments}x treatment)`, now]
          );
        }
      }
    });

    await get().load();
    const found = get().members.find((m) => m.id === savedId);
    if (!found) throw new Error("Gagal memuat member yang baru disimpan");
    return found;
  },

  async remove(id) {
    await withTransaction(async (db) => {
      await db.runAsync("DELETE FROM member_point_logs WHERE member_id = ?", [id]);
      await db.runAsync("DELETE FROM members WHERE id = ?", [id]);
    });
    await get().load();
  },

  async addTreatmentPoints(memberId, treatmentsCount = 1, customNote) {
    if (!Number.isInteger(treatmentsCount) || treatmentsCount < 1) {
      throw new Error("Jumlah treatment minimal 1");
    }
    const delta = treatmentsCount * POINTS_PER_TREATMENT;
    const now = new Date().toISOString();

    await withTransaction(async (db) => {
      const row = await db.getFirstAsync<any>("SELECT * FROM members WHERE id = ?", [memberId]);
      if (!row) throw new Error("Member tidak ditemukan");

      const newPoints = (Number(row.points) || 0) + delta;
      const newTreatments = (Number(row.total_treatments) || 0) + treatmentsCount;

      await db.runAsync(
        "UPDATE members SET points = ?, total_treatments = ?, updated_at = ? WHERE id = ?",
        [newPoints, newTreatments, now, memberId]
      );

      await db.runAsync(
        `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
         VALUES (?,?,NULL,'earn',?,?,?,?)`,
        [newId(), memberId, delta, treatmentsCount, customNote?.trim() || `Tambah ${treatmentsCount}x treatment (+${delta} poin)`, now]
      );
    });

    await get().load();
  },

  async redeemFreeTreatment(memberId, customNote) {
    const now = new Date().toISOString();

    await withTransaction(async (db) => {
      const row = await db.getFirstAsync<any>("SELECT * FROM members WHERE id = ?", [memberId]);
      if (!row) throw new Error("Member tidak ditemukan");

      const currentPoints = Number(row.points) || 0;
      if (currentPoints < FREE_TREATMENT_POINTS) {
        throw new Error(`Poin belum cukup (${currentPoints}/${FREE_TREATMENT_POINTS} poin)`);
      }

      const newPoints = currentPoints - FREE_TREATMENT_POINTS;
      const newRedeemed = (Number(row.total_redeemed) || 0) + 1;

      await db.runAsync(
        "UPDATE members SET points = ?, total_redeemed = ?, updated_at = ? WHERE id = ?",
        [newPoints, newRedeemed, now, memberId]
      );

      await db.runAsync(
        `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
         VALUES (?,?,NULL,'redeem',?,1,?,?)`,
        [newId(), memberId, -FREE_TREATMENT_POINTS, customNote?.trim() || "Klaim Gratis 1x Treatment (-100 poin)", now]
      );
    });

    await get().load();
  },

  async getLogs(memberId) {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM member_point_logs WHERE member_id = ? ORDER BY created_at DESC LIMIT 100",
      [memberId]
    );
    return rows.map(rowToLog);
  },
}));
