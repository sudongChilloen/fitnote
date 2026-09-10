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
import { createSession, deleteSession } from "@/app/lib/session";

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
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return { message: "이미 가입된 이메일입니다." };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      memberProfile: { create: {} },
    },
    select: { id: true },
  });

  await createSession(user.id);

  redirect("/home");
}

/**
 * 트레이너가 만들어 둔 계정을 이어받는다.
 *
 * signup 에 분기를 넣지 않고 따로 뒀다. 이 흐름은 이름을 받지 않고, User 를
 * 만들지 않고, 실패했을 때 할 말도 다르다. 한 함수에 담으면 "코드가 있으면
 * 이건 건너뛰고" 가 계속 붙는데, 그 조건문이 하나라도 어긋나면 남의 계정에
 * 비밀번호가 걸린다.
 */
export async function claimAccount(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const code = String(formData.get("code") ?? "");

  const validated = ClaimFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  let user: { id: string };

  try {
    user = await claimMemberAccount(code, {
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    });
  } catch (error) {
    if (error instanceof ConnectionError) {
      return { message: error.message };
    }

    console.error("claim account error:", error);
    return { message: "잠시 후 다시 시도해주세요." };
  }

  await createSession(user.id);

  redirect("/home");
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
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true },
  });

  // 계정 존재 여부가 드러나지 않도록 동일한 메시지를 사용한다.
  const invalidMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";

  if (!user?.passwordHash) {
    return { message: invalidMessage };
  }

  const matched = await bcrypt.compare(password, user.passwordHash);

  if (!matched) {
    return { message: invalidMessage };
  }

  if (user.status !== "ACTIVE") {
    return { message: "이용이 제한된 계정입니다." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id);

  redirect("/home");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
