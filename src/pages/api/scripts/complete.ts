// pages/api/scripts/complete.ts
import { NextApiRequest, NextApiResponse } from "next";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User, ScriptType, ScriptStatus } from "@/types/firebase";

interface CompleteScriptRequest {
  userId: string;
  scriptId: number; // number로 변경
  scriptType: ScriptType;
  recordingId: string; // audioRecordings 컬렉션 참조
  audioUrl: string;
  sttText: string;
}

interface CompleteScriptResponse {
  success: boolean;
  message?: string;
  user?: User; // 업데이트된 사용자 정보 반환
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompleteScriptResponse>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      userId,
      scriptId,
      scriptType,
      recordingId,
      audioUrl,
      // sttText,
    }: CompleteScriptRequest = req.body;

    if (!userId || scriptId === undefined || !scriptType || !recordingId || !audioUrl) {
      return res.status(400).json({
        success: false,
        message: "필수 필드가 누락되었습니다.",
      });
    }

    // 1. 사용자 정보 조회
    const userRef = doc(db, "usersV2", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    const userData = userDoc.data() as User;
    
    // 2. scriptAssignments 업데이트
    const updatedAssignments = userData.scriptAssignments.map(assignment => {
      if (assignment.scriptType === scriptType) {
        // assignedScriptIds에서 제거하고 completedScriptIds에 추가
        const newAssignedIds = assignment.assignedScriptIds.filter(id => id !== scriptId);
        const newCompletedIds = assignment.completedScriptIds.includes(scriptId) 
          ? assignment.completedScriptIds 
          : [...assignment.completedScriptIds, scriptId];

        return {
          ...assignment,
          assignedScriptIds: newAssignedIds,
          completedScriptIds: newCompletedIds,
        };
      }
      return assignment;
    });

    // 3. 사용자 정보 업데이트
    const now = new Date().toISOString();
    const updatedUserData: Partial<User> = {
      scriptAssignments: updatedAssignments,
      lastAccessAt: now,
    };

    await updateDoc(userRef, {
      ...updatedUserData,
      lastAccessAt: serverTimestamp(), // Firestore 서버 시간 사용
    });

    // 4. scripts 컬렉션의 해당 스크립트 상태 업데이트
    const scriptKey = `${scriptType}_${scriptId}`;
    const scriptRef = doc(db, "scripts", scriptKey);
    
    await updateDoc(scriptRef, {
      status: ScriptStatus.COMPLETED,
      completedAt: serverTimestamp(),
      recordingId, // audioRecordings 컬렉션 참조
    });

    // 5. 업데이트된 사용자 정보 반환
    const finalUserData: User = {
      ...userData,
      ...updatedUserData,
      lastAccessAt: now,
    };

    return res.status(200).json({
      success: true,
      message: "스크립트가 성공적으로 완료되었습니다.",
      user: finalUserData,
    });

  } catch (error) {
    console.error("스크립트 완료 처리 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}