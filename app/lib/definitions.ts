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

/**
 * 트레이너가 만들어 둔 계정을 이어받을 때.
 *
 * 이름을 받지 않는다. 이름은 트레이너가 이미 적어 뒀고, 그 이름으로 알림장과
 * 수업이 쌓여 있다. 여기서 다시 물으면 회원이 다른 이름을 적을 수 있고 그러면
 * 트레이너의 목록에서 사람이 바뀐 것처럼 보인다.
 */
export const ClaimFormSchema = z.object({
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
