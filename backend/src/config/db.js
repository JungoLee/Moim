import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI 가 설정되지 않았습니다. backend/.env 를 확인하세요.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] MongoDB 연결됨');
}
