import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase Admin SDK 초기화
const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}

// 이미 초기화된 앱이 없을 때만 초기화
const app = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0]

// Firestore 인스턴스
export const db = getFirestore(app)

// 컬렉션 이름
export const COLLECTIONS = {
  EVALUATIONS: 'evaluations',
  AGENTS: 'agents',
  SYNC_LOGS: 'sync_logs',
}
