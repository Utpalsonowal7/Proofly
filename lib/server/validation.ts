import { z } from "zod";
export const id = z.uuid("This item could not be found.");
export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254));
export const registrationSchema = z.object({ name: z.string().trim().min(2, "Please enter your name.").max(80), email, password: z.string().min(12, "Use a password with at least 12 characters.").max(128) });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const projectFields = {
  name: z.string().trim().min(2, "Give your project a name.").max(120), client: z.string().trim().max(100).default(""),
  description: z.string().trim().max(1000).default(""), color: z.string().regex(/^#[a-fA-F0-9]{6}$/, "Choose a valid project color.").default("#b8c6aa"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Choose a valid due date.").nullable().default(null),
};
export const projectSchema = z.object(projectFields);
export const projectUpdateSchema = projectSchema.partial().extend({ archived: z.boolean().optional() });
export const commentSchema = z.object({ body: z.string().trim().min(1, "Write a little feedback first.").max(4000), x: z.number().min(0).max(1).nullable().default(null), y: z.number().min(0).max(1).nullable().default(null), parentId: id.nullable().optional(), authorName: z.string().trim().min(2).max(80).optional() })
  .refine(v => (v.x === null) === (v.y === null), "A pinned comment needs both coordinates.")
  .refine(v => !v.parentId || (v.x === null && v.y === null), "Replies belong to their conversation.");
export const decisionSchema = z.object({ decision: z.enum(["approved", "changes_requested"]), authorName: z.string().trim().min(2).max(80).optional() });
export const uploadSchema = z.object({ projectId: id, assetId: id.optional(), filename: z.string().trim().min(1).max(200), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), byteSize: z.number().int().min(1).max(20 * 1024 * 1024, "Images must be 20 MB or smaller."), width: z.number().int().min(1).max(20000), height: z.number().int().min(1).max(20000) });
export const shareSchema = z.object({ expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7), allowComments: z.boolean().default(true) });
