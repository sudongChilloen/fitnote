"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import {
  type AuthFormState,
  ClaimFormSchema,
  LoginFormSchema,
  SignupFormSchema,
} from "@/app/lib/definitions";

import {
  ConnectionError,
  claimMemberAccount,
} from "@/server/trainers/connection.service";

import { prisma } from "@/lib/prisma";
import {
  AUTH_LIMITS,
  RATE_LIMIT_MESSAGE,
  attemptKey,
  clearAttempts,
  getClientIp,
  isRateLimited,
  recordAttempt,
} from "@/app/lib/rate-limit";
import { createSession, deleteSession } from "@/app/lib/session";

const SALT_ROUNDS = 10;

/**
 * 없는 계정에도 같은 시간만큼 bcrypt 를 돌리기 위한 값.
 * 이게 없으면 없는 이메일이 눈에 띄게 빨리 돌아와 응답 시간으로 계정이 드러난다.
 */
const DUMMY_HASH =
  "$2b$10$kLb.J.yOyj1k9CAE8neuN.Giho6zF0SBQo5Al70SWGVLMLfWbPUoC";

export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = validated.data;

  const ip = await getClientIp();
  const signupKey = attemptKey("signup", ip);

  if (await isRateLimited(signupKey, AUTH_LIMITS.signupIp)) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  await recordAttempt(signupKey);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return {
      message: "이미 가입된 이메일이에요.",
    };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      memberProfile: {
        create: {},
      },
    },
    select: {
      id: true,
    },
  });

  await createSession(user.id);

  redirect("/home");
}

export async function claimAccount(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = ClaimFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const code = String(formData.get("code") ?? "");

  if (!code) {
    return {
      message: "이어받기 코드가 없어요.",
    };
  }

  const { email, password } = validated.data;

  const claimKey = attemptKey("claim", await getClientIp());

  if (await isRateLimited(claimKey, AUTH_LIMITS.claimIp)) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await claimMemberAccount(code, {
      email,
      passwordHash,
    });

    await createSession(user.id);

    redirect("/home");
  } catch (error) {
    if (error instanceof ConnectionError) {
      // 코드를 추측하는 시도를 막으려고 실패만 센다.
      await recordAttempt(claimKey);

      return {
        message: error.message,
      };
    }

    throw error;
  }
}

export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validated.data;

  const ip = await getClientIp();
  const accountKey = attemptKey("login", ip, email);
  const ipKey = attemptKey("login", ip);

  if (
    (await isRateLimited(accountKey, AUTH_LIMITS.loginAccount)) ||
    (await isRateLimited(ipKey, AUTH_LIMITS.loginIp))
  ) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      trainerProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  const invalidMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";

  const matched = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user?.passwordHash || !matched) {
    await Promise.all([recordAttempt(accountKey), recordAttempt(ipKey)]);

    return {
      message: invalidMessage,
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      message: "이용이 제한된 계정입니다.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await clearAttempts(accountKey);
  await createSession(user.id);

  if (user.trainerProfile) {
    redirect("/trainer");
  }

  redirect("/home");
}

export async function logout() {
  await deleteSession();

  redirect("/login");
}
