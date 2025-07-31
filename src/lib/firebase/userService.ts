// lib/firebase/userService.ts - 서브컬렉션 쿼리 함수들
import {
  doc,
  collection,
  onSnapshot,
  getDoc,
  query,
  getDocs,
  orderBy,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ParticipationRound } from "@/types/user";

/**
 * 특정 라운드 데이터 실시간 구독
 */
export const subscribeToCurrentRound = (
  userId: string,
  roundNumber: number,
  callback: (round: ParticipationRound | null) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const roundRef = doc(db, "users", userId, "rounds", roundNumber.toString());

  return onSnapshot(
    roundRef,
    (doc) => {
      if (doc.exists()) {
        callback({ ...doc.data() } as ParticipationRound);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("라운드 구독 에러:", error);
      onError?.(error);
    }
  );
};

/**
 * 특정 라운드 데이터 단일 조회
 */
export const getCurrentRoundData = async (
  userId: string,
  roundNumber: number
): Promise<ParticipationRound | null> => {
  try {
    // Firestore 컬렉션 이름 설정
    const userCollection =
      process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "whitelist-temp";

    const roundRef = doc(
      db,
      userCollection,
      userId,
      "rounds",
      roundNumber.toString()
    );
    const roundSnap = await getDoc(roundRef);

    // console.log("이거 뭐야?", roundSnap);

    if (roundSnap.exists()) {
      return { ...roundSnap.data() } as ParticipationRound;
    }
    return null;
  } catch (error) {
    console.error("라운드 데이터 조회 에러:", error);
    throw error;
  }
};

/**
 * 사용자의 모든 라운드 실시간 구독
 */
export const subscribeToUserRounds = (
  userId: string,
  callback: (rounds: ParticipationRound[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const roundsRef = collection(db, "users", userId, "rounds");
  const roundsQuery = query(roundsRef, orderBy("roundNumber", "asc"));

  return onSnapshot(
    roundsQuery,
    (snapshot) => {
      const rounds = snapshot.docs.map((doc) => ({
        ...doc.data(),
      })) as ParticipationRound[];
      callback(rounds);
    },
    (error) => {
      console.error("라운드 목록 구독 에러:", error);
      onError?.(error);
    }
  );
};
export const getUserRounds = async (
  userId: string
): Promise<ParticipationRound[]> => {
  try {
    const userCollectionName =
      process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
    const roundsCollectionRef = collection(
      db,
      userCollectionName,
      userId,
      "rounds"
    );
    const querySnapshot = await getDocs(roundsCollectionRef);

    const rounds: ParticipationRound[] = [];
    querySnapshot.forEach((doc) => {
      rounds.push({ ...doc.data() } as ParticipationRound);
    });

    return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  } catch (error) {
    console.error("getUserRounds 오류:", error);
    throw error;
  }
};
