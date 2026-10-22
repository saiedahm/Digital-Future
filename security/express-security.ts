import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z, type ZodTypeAny } from "zod";
import type { Request, Response, NextFunction } from "express";

const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "https://digital-future.ai,https://www.digital-future.ai")
    .split(",").map((value) => value.trim()).filter(Boolean),
);

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'", "https://checkout.stripe.com"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,
});

export const strictCors = cors({
  origin(origin, callback) {
    // Permit non-browser server-to-server requests without Origin; browsers are allowlisted.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("CORS origin denied"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  maxAge: 600,
});

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." },
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ungültige Eingabedaten." });
    res.locals.validatedBody = parsed.data as z.infer<T>;
    return next();
  };
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: "Origin nicht erlaubt." });
  return next();
}
