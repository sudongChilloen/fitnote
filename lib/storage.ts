import "server-only";

/**
 * Supabase Storage.
 *
 * SDK 를 넣지 않고 REST 로 직접 부른다. 브라우저가 하는 일은 서명된 주소로 PUT 하는
 * 것뿐이라 클라이언트 번들에 SDK 를 넣을 이유가 없다.
 *
 * 버킷은 비공개다. 회원의 몸 사진과 식단이 들어가므로 주소만 알면 누구나 보는 공개
 * 버킷은 쓸 수 없다. 읽을 때마다 짧게 사는 서명 주소를 만들어 준다.
 */

const PROJECT_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const PHOTO_BUCKET =
  process.env.SUPABASE_PHOTO_BUCKET ?? "fitnote-photos";

/** 읽기용 서명 주소의 수명. 화면을 열어 둔 채 잠깐 자리를 비워도 사진이 깨지지 않을 만큼. */
const READ_URL_TTL_SEC = 60 * 60;

export class StorageError extends Error {
  constructor(
    readonly code: "NOT_CONFIGURED" | "UPSTREAM",
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export function isStorageConfigured() {
  return Boolean(PROJECT_URL && SERVICE_KEY);
}

function config() {
  if (!PROJECT_URL || !SERVICE_KEY) {
    throw new StorageError(
      "NOT_CONFIGURED",
      "사진 저장소가 설정되지 않았어요. SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 확인해주세요.",
    );
  }
  return { base: `${PROJECT_URL}/storage/v1`, key: SERVICE_KEY };
}

async function call(path: string, init: RequestInit) {
  const { base, key } = config();

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new StorageError(
      "UPSTREAM",
      `저장소 요청이 실패했어요 (${res.status}) ${body.slice(0, 200)}`,
    );
  }

  return res;
}

/**
 * 버킷을 만든다. 이미 있으면 그대로 둔다.
 *
 * 배포마다 부르는 게 아니라 준비 스크립트에서 한 번 부른다.
 */
export async function ensurePhotoBucket() {
  const { base, key } = config();

  const exists = await fetch(`${base}/bucket/${PHOTO_BUCKET}`, {
    headers: { authorization: `Bearer ${key}`, apikey: key },
    cache: "no-store",
  });

  if (exists.ok) return { created: false };

  await call("/bucket", {
    method: "POST",
    body: JSON.stringify({
      id: PHOTO_BUCKET,
      name: PHOTO_BUCKET,
      public: false,
      // 브라우저에서 1600px WebP 로 줄여 올리므로 넉넉잡아도 이 정도면 충분하다.
      // 한도를 두지 않으면 원본을 그대로 올리는 경로가 생겼을 때 요금이 새어 나간다.
      file_size_limit: 5 * 1024 * 1024,
      allowed_mime_types: ["image/webp", "image/jpeg", "image/png"],
    }),
  });

  return { created: true };
}

export interface SignedUpload {
  /** 브라우저가 그대로 PUT 할 절대 주소. */
  uploadUrl: string;
  /** 저장소 안의 경로. 업로드가 끝나면 이 값을 DB 에 넣는다. */
  path: string;
}

/**
 * 브라우저가 직접 올릴 수 있는 주소를 만든다.
 *
 * 서버를 거쳐 올리지 않는 이유는 두 가지다. 서버 액션 본문 한도가 기본 1MB 라 사진이
 * 들어가지 않고, 거쳐 가면 같은 파일이 올라갔다 내려갔다 하며 전송량을 두 배로 쓴다.
 */
export async function createSignedUpload(path: string): Promise<SignedUpload> {
  const { base } = config();

  const res = await call(`/object/upload/sign/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const json = (await res.json()) as { url?: string };

  if (!json.url) {
    throw new StorageError("UPSTREAM", "업로드 주소를 받지 못했어요.");
  }

  // 응답의 url 은 /object/upload/sign/... 형태의 상대 경로다.
  return { uploadUrl: `${base}${json.url}`, path };
}

/**
 * 읽기용 서명 주소를 한 번에 만든다.
 *
 * 사진 한 장마다 따로 부르면 알림장 하나 여는 데 요청이 다섯 번씩 나간다.
 * 못 만든 경로는 결과에서 빠지므로, 부르는 쪽에서 없는 경우를 처리해야 한다.
 */
export async function createSignedReadUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const res = await call(`/object/sign/${PHOTO_BUCKET}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: READ_URL_TTL_SEC, paths: unique }),
  });

  const rows = (await res.json()) as {
    path?: string | null;
    signedURL?: string | null;
    signedUrl?: string | null;
    error?: string | null;
  }[];

  const { base } = config();
  const map = new Map<string, string>();

  for (const row of rows) {
    const signed = row.signedURL ?? row.signedUrl;
    if (!row.path || !signed || row.error) continue;

    map.set(row.path, signed.startsWith("http") ? signed : `${base}${signed}`);
  }

  return map;
}

/** 지운 사진을 저장소에서도 지운다. DB 만 지우면 요금이 계속 나간다. */
export async function removeObjects(paths: string[]) {
  const targets = paths.filter(Boolean);
  if (targets.length === 0) return;

  await call(`/object/${PHOTO_BUCKET}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: targets }),
  });
}
