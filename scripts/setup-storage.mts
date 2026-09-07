/**
 * 사진 버킷을 만든다.
 *
 * 새 환경(다른 Supabase 프로젝트)에서 한 번만 돌리면 된다.
 *
 *   npx tsx --conditions=react-server scripts/setup-storage.mts
 */
import "dotenv/config";
import { ensurePhotoBucket, PHOTO_BUCKET } from "../lib/storage.js";
const r = await ensurePhotoBucket();
console.log(r.created ? `버킷 ${PHOTO_BUCKET} 을 만들었어요.` : `버킷 ${PHOTO_BUCKET} 이 이미 있어요.`);
