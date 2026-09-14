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
  createSession,
  deleteSession,
} from "@/app/lib/session";

const SALT_ROUNDS = 10;

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

  const {
    name,
    email,
    password,
  } = validated.data;

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

  const {
    email,
    password,
  } = validated.data;

  try {
    const passwordHash = await bcrypt.hash(
      password,
      SALT_ROUNDS,
    );

    const user = await claimMemberAccount(code, {
      email,
      passwordHash,
    });

    await createSession(user.id);

    redirect("/home");
  } catch (error) {
    if (error instanceof ConnectionError) {
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

  const {
    email,
    password,
  } = validated.data;

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

  const invalidMessage =
    "이메일 또는 비밀번호가 올바르지 않습니다.";

  if (!user?.passwordHash) {
    return {
      message: invalidMessage,
    };
  }

  const matched = await bcrypt.compare(
    password,
    user.passwordHash,
  );

  if (!matched) {
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

  await createSession(user.id);

  /**
   * TrainerProfile이 있는 계정은 트레이너가 기본 앱이다.
   *
   * 트레이너가 동시에 회원이어도 여기서는 /trainer로 시작한다.
   * 회원 화면은 트레이너 화면의 "회원 화면" 전환 버튼으로 들어간다.
   */
  if (user.trainerProfile) {
    redirect("/trainer");
  }

  redirect("/home");
}

export async function logout() {
  await deleteSession();

  redirect("/login");
}