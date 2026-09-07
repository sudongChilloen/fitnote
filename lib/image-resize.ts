/**
 * 올리기 전에 브라우저에서 사진을 줄인다.
 *
 * 요즘 폰 사진은 한 장에 4MB 가 넘는다. 그대로 올리면 회원 한 명당 수업마다 20MB 씩
 * 쌓이고, 트레이너 데이터도 그만큼 나간다. 긴 변 1600px WebP 로 줄이면 자세를 보기에는
 * 충분하면서 300KB 안팎이 된다.
 */

export interface ResizedImage {
  full: Blob;
  thumbnail: Blob;
}

const FULL_MAX_EDGE = 1600;
const THUMB_MAX_EDGE = 480;

async function draw(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진을 줄일 수 없어요.");

  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });

  if (!blob) throw new Error("사진을 줄일 수 없어요.");

  return blob;
}

export async function resizeImage(file: File): Promise<ResizedImage> {
  // createImageBitmap 은 디코딩을 워커 스레드에서 한다. img 태그로 읽으면 큰 사진에서
  // 화면이 멈춘다.
  const bitmap = await createImageBitmap(file);

  try {
    const [full, thumbnail] = await Promise.all([
      draw(bitmap, FULL_MAX_EDGE, 0.82),
      draw(bitmap, THUMB_MAX_EDGE, 0.75),
    ]);

    return { full, thumbnail };
  } finally {
    bitmap.close();
  }
}
