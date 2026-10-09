import mongoose, { Schema, Document } from 'mongoose';

/** Server-generated admin audit trail. Frontend can read, never write. */
export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  adminEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  outcome: 'success' | 'failure';
  meta?: any;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminEmail: { type: String, trim: true, maxlength: 200 },
    action: { type: String, required: true, trim: true, maxlength: 100, index: true },
    targetType: { type: String, required: true, trim: true, maxlength: 50 },
    targetId: { type: String, trim: true, maxlength: 100 },
    reason: { type: String, maxlength: 500 },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success', index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export async function recordAudit(entry: {
  adminId: string;
  adminEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  outcome?: 'success' | 'failure';
  meta?: any;
}): Promise<void> {
  try {
    await AuditLog.create({ outcome: 'success', ...entry });
  } catch (e) {
    // Audit must never break the admin action itself
    console.error('[audit] write failed:', (e as Error).message);
  }
}
