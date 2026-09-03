import * as z from "zod";

export const SignupFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "이름은 2자 이상 입력해주세요." })
    .max(20, { error: "이름은 20자 이하로 입력해주세요." })
    .trim(),
  email: z.email({ error: "올바른 이메일 형식이 아닙니다." }).trim(),
  password: z
    .string()
    .min(8, { error: "비밀번호는 8자 이상이어야 합니다." })
    .regex(/[a-zA-Z]/, { error: "영문을 최소 1자 포함해야 합니다." })
    .regex(/[0-9]/, { error: "숫자를 최소 1자 포함해야 합니다." })
    .trim(),
});

export const LoginFormSchema = z.object({
  email: z.email({ error: "올바른 이메일 형식이 아닙니다." }).trim(),
  password: z.string().min(1, { error: "비밀번호를 입력해주세요." }),
});

export type AuthFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
