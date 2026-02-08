import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";

const app = express();
const prisma = new PrismaClient();

const port = Number(process.env.PORT ?? 4000);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const jwtSecret = process.env.JWT_SECRET;
const sessionCookie = "budgeter_session";
const totpIssuer = process.env.TOTP_ISSUER ?? "Budgeter";

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

app.use(
  cors({
    origin: frontendUrl,
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

const monthRegex = /^\d{4}-\d{2}$/;

const toMonthStart = (value?: string) => {
  const now = new Date();
  const month = value ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  if (!monthRegex.test(month)) {
    return null;
  }

  const date = new Date(`${month}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : { month, date };
};

const formatMonth = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (date: Date, count: number) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
  return next;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const applyPayeeRename = (
  payeeName: string | null,
  renames: { matchText: string; renameTo: string }[]
) => {
  if (!payeeName) return null;
  const normalized = normalizeText(payeeName);
  const match = renames.find((rule) => normalized.includes(normalizeText(rule.matchText)));
  return match ? match.renameTo : payeeName;
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const signToken = (payload: { userId: string; email: string }) => {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
};

const authRequired: express.RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[sessionCookie];
    if (!token || !jwtSecret) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const payload = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    (req as express.Request & { user?: { id: string; email: string } }).user = {
      id: payload.userId,
      email: payload.email
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "unauthorized" });
  }
};

app.post("/auth/setup", async (req, res, next) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const existing = await prisma.user.findFirst();
    if (existing) {
      res.status(400).json({ error: "setup already completed" });
      return;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash
      }
    });

    const token = signToken({ userId: user.id, email: user.email });
    res.cookie(sessionCookie, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/status", async (_req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({
      select: { id: true }
    });
    res.json({ setupComplete: Boolean(existing) });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password, otp } = req.body as {
      email?: string;
      password?: string;
      otp?: string;
    };
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    if (user.twoFactorEnabled) {
      if (!otp) {
        res.status(401).json({ error: "otp_required" });
        return;
      }
      const otpValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret ?? "",
        encoding: "base32",
        token: otp,
        window: 1
      });
      if (!otpValid) {
        res.status(401).json({ error: "invalid_otp" });
        return;
      }
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.cookie(sessionCookie, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  res.json({ status: "ok" });
});

app.post("/auth/2fa/setup", authRequired, async (_req, res, next) => {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      res.status(400).json({ error: "no user found" });
      return;
    }
    if (user.twoFactorEnabled) {
      res.status(400).json({ error: "2fa already enabled" });
      return;
    }

    const secret = speakeasy.generateSecret({
      name: `${totpIssuer}:${user.email}`,
      issuer: totpIssuer
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 }
    });

    const qrCode = await qrcode.toDataURL(secret.otpauth_url ?? "");
    res.json({ otpauthUrl: secret.otpauth_url, qrCode, secret: secret.base32 });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/2fa/verify", authRequired, async (req, res, next) => {
  try {
    const { otp } = req.body as { otp?: string };
    if (!otp) {
      res.status(400).json({ error: "otp is required" });
      return;
    }

    const user = await prisma.user.findFirst();
    if (!user?.twoFactorSecret) {
      res.status(400).json({ error: "2fa not initialized" });
      return;
    }

    const otpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: otp,
      window: 1
    });

    if (!otpValid) {
      res.status(401).json({ error: "invalid_otp" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    });

    res.json({ status: "enabled" });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/2fa/disable", authRequired, async (req, res, next) => {
  try {
    const { otp } = req.body as { otp?: string };
    if (!otp) {
      res.status(400).json({ error: "otp is required" });
      return;
    }

    const user = await prisma.user.findFirst();
    if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
      res.status(400).json({ error: "2fa not enabled" });
      return;
    }

    const otpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: otp,
      window: 1
    });

    if (!otpValid) {
      res.status(401).json({ error: "invalid_otp" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null }
    });

    res.json({ status: "disabled" });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", authRequired, async (req, res) => {
  const user = (req as express.Request & { user?: { id: string; email: string } }).user;
  res.json({ id: user?.id, email: user?.email });
});

app.use(authRequired);


app.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: "asc" }
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/categories", async (req, res, next) => {
  try {
    const { name, recurring } = req.body as {
      name?: string;
      recurring?: boolean;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        recurring: Boolean(recurring)
      }
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

app.patch("/categories/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recurring } = req.body as {
      recurring?: boolean;
    };

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(recurring !== undefined ? { recurring: Boolean(recurring) } : {})
      }
    });

    res.json(category);
  } catch (error) {
    next(error);
  }
});

app.delete("/categories/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/payee-rules", async (_req, res, next) => {
  try {
    const rules = await prisma.payeeRule.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

app.post("/payee-rules", async (req, res, next) => {
  try {
    const { matchText, categoryId } = req.body as { matchText?: string; categoryId?: string };

    if (!matchText?.trim()) {
      res.status(400).json({ error: "matchText is required" });
      return;
    }

    if (!categoryId) {
      res.status(400).json({ error: "categoryId is required" });
      return;
    }

    const rule = await prisma.payeeRule.create({
      data: { matchText: matchText.trim(), categoryId },
      include: { category: true }
    });

    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
});

app.delete("/payee-rules/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.payeeRule.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/payee-renames", async (_req, res, next) => {
  try {
    const renames = await prisma.payeeRename.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(renames);
  } catch (error) {
    next(error);
  }
});

app.post("/payee-renames", async (req, res, next) => {
  try {
    const { matchText, renameTo } = req.body as { matchText?: string; renameTo?: string };

    if (!matchText?.trim()) {
      res.status(400).json({ error: "matchText is required" });
      return;
    }

    if (!renameTo?.trim()) {
      res.status(400).json({ error: "renameTo is required" });
      return;
    }

    const rename = await prisma.payeeRename.create({
      data: { matchText: matchText.trim(), renameTo: renameTo.trim() }
    });

    res.status(201).json(rename);
  } catch (error) {
    next(error);
  }
});

app.delete("/payee-renames/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.payeeRename.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/accounts", async (_req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });
    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

app.post("/accounts", async (req, res, next) => {
  try {
    const { name, type, balance } = req.body as {
      name?: string;
      type?: "ASSET" | "LIABILITY";
      balance?: number;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    if (type !== "ASSET" && type !== "LIABILITY") {
      res.status(400).json({ error: "type must be ASSET or LIABILITY" });
      return;
    }

    if (typeof balance !== "number" || Number.isNaN(balance)) {
      res.status(400).json({ error: "balance must be a number" });
      return;
    }

    const account = await prisma.account.create({
      data: {
        name: name.trim(),
        type,
        balance
      }
    });

    await prisma.accountBalance.create({
      data: {
        accountId: account.id,
        balance
      }
    });

    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

app.patch("/accounts/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, balance } = req.body as {
      name?: string;
      type?: "ASSET" | "LIABILITY";
      balance?: number;
    };

    if (type && type !== "ASSET" && type !== "LIABILITY") {
      res.status(400).json({ error: "type must be ASSET or LIABILITY" });
      return;
    }

    if (balance !== undefined && (typeof balance !== "number" || Number.isNaN(balance))) {
      res.status(400).json({ error: "balance must be a number" });
      return;
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(type ? { type } : {}),
        ...(balance !== undefined ? { balance } : {})
      }
    });

    if (balance !== undefined) {
      await prisma.accountBalance.create({
        data: {
          accountId: account.id,
          balance
        }
      });
    }

    res.json(account);
  } catch (error) {
    next(error);
  }
});

app.delete("/accounts/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.account.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/accounts/:id/balances", async (req, res, next) => {
  try {
    const { id } = req.params;
    const balances = await prisma.accountBalance.findMany({
      where: { accountId: id },
      orderBy: { recordedAt: "asc" }
    });
    res.json(balances);
  } catch (error) {
    next(error);
  }
});

app.get("/reports/net-worth", async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    const parsedFrom = toMonthStart(from);
    const parsedTo = toMonthStart(to);

    if (!parsedFrom || !parsedTo) {
      res.status(400).json({ error: "from and to must be YYYY-MM" });
      return;
    }

    const start = parsedFrom.date;
    const endExclusive = addMonths(parsedTo.date, 1);

    const accounts = await prisma.account.findMany();
    const balances = await prisma.accountBalance.findMany({
      where: {
        recordedAt: {
          gte: start,
          lt: endExclusive
        }
      },
      orderBy: { recordedAt: "asc" }
    });

    const balanceByAccount = new Map<string, { recordedAt: Date; balance: number }[]>();
    balances.forEach((entry) => {
      const list = balanceByAccount.get(entry.accountId) ?? [];
      list.push({ recordedAt: entry.recordedAt, balance: entry.balance });
      balanceByAccount.set(entry.accountId, list);
    });

    const trend: { month: string; assets: number; liabilities: number; net: number }[] = [];
    for (let cursor = new Date(start); cursor < endExclusive; cursor = addMonths(cursor, 1)) {
      const monthEnd = addMonths(cursor, 1);
      let assets = 0;
      let liabilities = 0;
      accounts.forEach((account) => {
        const entries = balanceByAccount.get(account.id) ?? [];
        const last = entries
          .filter((entry) => entry.recordedAt < monthEnd)
          .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
        const value = last ? last.balance : 0;
        if (account.type === "ASSET") assets += value;
        else liabilities += value;
      });
      trend.push({
        month: formatMonth(cursor),
        assets,
        liabilities,
        net: assets - liabilities
      });
    }

    res.json({ trend });
  } catch (error) {
    next(error);
  }
});

app.get("/budgets", async (req, res, next) => {
  try {
    const parsed = toMonthStart(typeof req.query.month === "string" ? req.query.month : undefined);

    if (!parsed) {
      res.status(400).json({ error: "month must be YYYY-MM" });
      return;
    }

    const budgets = await prisma.monthlyBudget.findMany({
      where: { month: parsed.date },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }]
    });

    const recurringCategories = await prisma.category.findMany({
      where: { recurring: true },
      orderBy: { name: "asc" }
    });

    const budgetsByCategory = new Map(budgets.map((budget) => [budget.categoryId, budget]));
    const recurringFallbacks = await Promise.all(
      recurringCategories
        .filter((category) => !budgetsByCategory.has(category.id))
        .map(async (category) => {
          const latest = await prisma.monthlyBudget.findFirst({
            where: { categoryId: category.id, month: { lte: parsed.date } },
            orderBy: { month: "desc" }
          });

          if (!latest) {
            return null;
          }

          return {
            ...latest,
            id: `recurring-${category.id}`,
            month: parsed.date,
            category,
            targetAmount: latest.targetAmount ?? null
          };
        })
    );

    const normalized = [
      ...budgets,
      ...recurringFallbacks.filter((item): item is NonNullable<typeof item> => Boolean(item))
    ];

    const prevMonthStart = addMonths(parsed.date, -1);
    const prevMonthEnd = addMonths(prevMonthStart, 1);
    const [prevBudgets, prevSpends] = await Promise.all([
      prisma.monthlyBudget.findMany({
        where: { month: prevMonthStart }
      }),
      prisma.spend.findMany({
        where: {
          spentAt: {
            gte: prevMonthStart,
            lt: prevMonthEnd
          }
        }
      })
    ]);

    const prevBudgetMap = new Map(prevBudgets.map((budget) => [budget.categoryId, budget.amount]));
    const prevSpendMap = new Map<string, number>();
    prevSpends.forEach((spend) => {
      prevSpendMap.set(spend.categoryId, (prevSpendMap.get(spend.categoryId) ?? 0) + spend.amount);
    });

    res.json(
      normalized.map((budget) => {
        const prevBudgetAmount = prevBudgetMap.get(budget.categoryId) ?? 0;
        const prevSpent = prevSpendMap.get(budget.categoryId) ?? 0;
        const rolloverAmount = prevBudgetAmount - prevSpent;
        return {
          ...budget,
          month: formatMonth(budget.month),
          rolloverAmount,
          effectiveAmount: budget.amount + rolloverAmount
        };
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/budgets", async (req, res, next) => {
  try {
    const { categoryId, month, amount, targetAmount } = req.body as {
      categoryId?: string;
      month?: string;
      amount?: number;
      targetAmount?: number | null;
    };

    if (!categoryId) {
      res.status(400).json({ error: "categoryId is required" });
      return;
    }

    if (amount !== undefined) {
      if (typeof amount !== "number" || Number.isNaN(amount)) {
        res.status(400).json({ error: "amount must be a number" });
        return;
      }
    }

    if (targetAmount !== undefined && targetAmount !== null && typeof targetAmount !== "number") {
      res.status(400).json({ error: "targetAmount must be a number" });
      return;
    }

    const parsed = toMonthStart(month);
    if (!parsed) {
      res.status(400).json({ error: "month must be YYYY-MM" });
      return;
    }

    const budget = await prisma.monthlyBudget.upsert({
      where: {
        categoryId_month: {
          categoryId,
          month: parsed.date
        }
      },
      update: {
        ...(amount !== undefined ? { amount } : {}),
        ...(targetAmount !== undefined ? { targetAmount } : {})
      },
      create: {
        categoryId,
        month: parsed.date,
        amount: amount ?? 0,
        targetAmount: targetAmount ?? null
      },
      include: { category: true }
    });

    res.status(201).json({ ...budget, month: parsed.month });
  } catch (error) {
    next(error);
  }
});

app.get("/spends", async (req, res, next) => {
  try {
    const parsed = toMonthStart(typeof req.query.month === "string" ? req.query.month : undefined);

    if (!parsed) {
      res.status(400).json({ error: "month must be YYYY-MM" });
      return;
    }

    const start = parsed.date;
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const [spends, renames] = await Promise.all([
      prisma.spend.findMany({
        where: {
          spentAt: {
            gte: start,
            lt: end
          }
        },
        include: { category: true },
        orderBy: { spentAt: "desc" }
      }),
      prisma.payeeRename.findMany()
    ]);

    res.json(
      spends.map((spend) => ({
        ...spend,
        payeeDisplay: applyPayeeRename(spend.payeeName ?? null, renames)
      }))
    );
  } catch (error) {
    next(error);
  }
});

app.post("/spends", async (req, res, next) => {
  try {
    const { categoryId, amount, spentAt, notes, recurring, payeeName } = req.body as {
      categoryId?: string;
      amount?: number;
      spentAt?: string;
      notes?: string;
      recurring?: boolean;
      payeeName?: string;
    };

    if (typeof amount !== "number" || Number.isNaN(amount)) {
      res.status(400).json({ error: "amount must be a number" });
      return;
    }

    const parsedDate = toDate(spentAt);
    if (!parsedDate) {
      res.status(400).json({ error: "spentAt must be a valid date" });
      return;
    }

    let resolvedCategoryId = categoryId ?? null;

    if (!resolvedCategoryId && payeeName) {
      const rules = await prisma.payeeRule.findMany();
      const normalized = normalizeText(payeeName);
      const match = rules.find((rule) => normalized.includes(normalizeText(rule.matchText)));
      resolvedCategoryId = match?.categoryId ?? null;
    }

    if (!resolvedCategoryId) {
      res.status(400).json({ error: "categoryId is required (or set a matching payee rule)" });
      return;
    }

    const spend = await prisma.spend.create({
      data: {
        categoryId: resolvedCategoryId,
        amount,
        spentAt: parsedDate,
        notes: notes?.trim() || null,
        recurring: Boolean(recurring),
        payeeName: payeeName?.trim() || null
      },
      include: { category: true }
    });

    const renames = await prisma.payeeRename.findMany();

    res.status(201).json({
      ...spend,
      payeeDisplay: applyPayeeRename(spend.payeeName ?? null, renames)
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/spends/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.spend.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/income", async (req, res, next) => {
  try {
    const parsed = toMonthStart(typeof req.query.month === "string" ? req.query.month : undefined);

    if (!parsed) {
      res.status(400).json({ error: "month must be YYYY-MM" });
      return;
    }

    const start = parsed.date;
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const income = await prisma.income.findMany({
      where: {
        receivedAt: {
          gte: start,
          lt: end
        }
      },
      orderBy: { receivedAt: "desc" }
    });

    res.json(income);
  } catch (error) {
    next(error);
  }
});

app.post("/income", async (req, res, next) => {
  try {
    const { amount, receivedAt, notes } = req.body as {
      amount?: number;
      receivedAt?: string;
      notes?: string;
    };

    if (typeof amount !== "number" || Number.isNaN(amount)) {
      res.status(400).json({ error: "amount must be a number" });
      return;
    }

    const parsedDate = toDate(receivedAt);
    if (!parsedDate) {
      res.status(400).json({ error: "receivedAt must be a valid date" });
      return;
    }

    const income = await prisma.income.create({
      data: {
        amount,
        receivedAt: parsedDate,
        notes: notes?.trim() || null
      }
    });

    res.status(201).json(income);
  } catch (error) {
    next(error);
  }
});

app.delete("/income/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.income.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/reports/spending", async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const month = typeof req.query.month === "string" ? req.query.month : undefined;

    const parsedFrom = toMonthStart(from);
    const parsedTo = toMonthStart(to);

    if (!parsedFrom || !parsedTo) {
      res.status(400).json({ error: "from and to must be YYYY-MM" });
      return;
    }

    const start = parsedFrom.date;
    const endExclusive = addMonths(parsedTo.date, 1);

    if (start > endExclusive) {
      res.status(400).json({ error: "from must be before to" });
      return;
    }

    const spends = await prisma.spend.findMany({
      where: {
        spentAt: {
          gte: start,
          lt: endExclusive
        }
      },
      include: { category: true }
    });

    const trendMap = new Map<string, number>();
    spends.forEach((spend) => {
      const monthKey = formatMonth(spend.spentAt);
      trendMap.set(monthKey, (trendMap.get(monthKey) ?? 0) + spend.amount);
    });

    const trend: { month: string; total: number }[] = [];
    for (
      let cursor = new Date(start);
      cursor < endExclusive;
      cursor = addMonths(cursor, 1)
    ) {
      const key = formatMonth(cursor);
      trend.push({ month: key, total: trendMap.get(key) ?? 0 });
    }

    let byCategory: { categoryId: string; categoryName: string; total: number }[] = [];
    if (month) {
      const parsedMonth = toMonthStart(month);
      if (!parsedMonth) {
        res.status(400).json({ error: "month must be YYYY-MM" });
        return;
      }
      const monthStart = parsedMonth.date;
      const monthEnd = addMonths(monthStart, 1);
      const categoryMap = new Map<string, { categoryId: string; categoryName: string; total: number }>();
      spends
        .filter((spend) => spend.spentAt >= monthStart && spend.spentAt < monthEnd)
        .forEach((spend) => {
          const existing = categoryMap.get(spend.categoryId) ?? {
            categoryId: spend.categoryId,
            categoryName: spend.category.name,
            total: 0
          };
          existing.total += spend.amount;
          categoryMap.set(spend.categoryId, existing);
        });
      byCategory = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    }

    res.json({ trend, byCategory });
  } catch (error) {
    next(error);
  }
});

app.get("/reports/cashflow", async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    const parsedFrom = toMonthStart(from);
    const parsedTo = toMonthStart(to);

    if (!parsedFrom || !parsedTo) {
      res.status(400).json({ error: "from and to must be YYYY-MM" });
      return;
    }

    const start = parsedFrom.date;
    const endExclusive = addMonths(parsedTo.date, 1);

    if (start > endExclusive) {
      res.status(400).json({ error: "from must be before to" });
      return;
    }

    const [spends, incomes] = await Promise.all([
      prisma.spend.findMany({
        where: {
          spentAt: {
            gte: start,
            lt: endExclusive
          }
        }
      }),
      prisma.income.findMany({
        where: {
          receivedAt: {
            gte: start,
            lt: endExclusive
          }
        }
      })
    ]);

    const spendMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();

    spends.forEach((spend) => {
      const key = formatMonth(spend.spentAt);
      spendMap.set(key, (spendMap.get(key) ?? 0) + spend.amount);
    });

    incomes.forEach((income) => {
      const key = formatMonth(income.receivedAt);
      incomeMap.set(key, (incomeMap.get(key) ?? 0) + income.amount);
    });

    const trend: { month: string; income: number; spend: number; net: number; rolling: number }[] = [];
    let rolling = 0;
    for (let cursor = new Date(start); cursor < endExclusive; cursor = addMonths(cursor, 1)) {
      const key = formatMonth(cursor);
      const income = incomeMap.get(key) ?? 0;
      const spend = spendMap.get(key) ?? 0;
      const net = income - spend;
      rolling += net;
      trend.push({
        month: key,
        income,
        spend,
        net,
        rolling
      });
    }

    res.json({ trend });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "internal server error" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
