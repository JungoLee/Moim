// Mongo 전체 컬렉션 → 리포 루트 backup/*.json 백업 (D1 이관 전 스냅샷)
// 사용: node backend/scripts/mongo-backup.mjs  (backend/.env 의 MONGODB_URI 사용)
// backup/ 은 gitignore — 커밋 금지
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(root, 'backup');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI 가 없습니다 (backend/.env 확인)');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;
fs.mkdirSync(outDir, { recursive: true });

const collections = await db.listCollections().toArray();
for (const { name } of collections) {
  const docs = await db.collection(name).find({}).toArray();
  // ObjectId.toJSON → 24-hex 문자열, Date.toJSON → ISO 문자열
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
  console.log(`${name}: ${docs.length}건`);
}

await mongoose.disconnect();
console.log(`백업 완료 → ${outDir}`);
