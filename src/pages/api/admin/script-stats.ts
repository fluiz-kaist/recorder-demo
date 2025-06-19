// pages/api/admin/script-stats.ts
import { NextApiRequest, NextApiResponse } from "next";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {ScriptStats, ScriptUsage } from "@/types/firebase";
import { loadAllScripts } from '../../../lib/scriptLoader';
interface StatsResponse {
  success: boolean;
  stats?: ScriptStats;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // 1. 전체 스크립트 수 가져오기
    const allScripts = await loadAllScripts();
    
    // 2. 사용 현황 데이터 가져오기
    const usageCollection = collection(db, 'scriptUsage');
    const usageDocs = await getDocs(usageCollection);
    
    const usageStats = {
      situational: { total: 0, available: 0, used: 0 },
      formal: { total: 0, available: 0, used: 0 },
      qaScenario: { total: 0, available: 0, used: 0 }
    };

    // 전체 스크립트 수 설정
    usageStats.situational.total = allScripts.situational.length;
    usageStats.formal.total = allScripts.formal.length;
    usageStats.qaScenario.total = allScripts.qaScenario.length;

    // 사용 현황 계산
    usageDocs.forEach(doc => {
      const data = doc.data() as ScriptUsage;
      const scriptType = doc.id as keyof typeof usageStats;
      
      if (usageStats[scriptType]) {
        Object.values(data).forEach(isUsed => {
          if (isUsed) {
            usageStats[scriptType].used++;
          } else {
            usageStats[scriptType].available++;
          }
        });
      }
    });

    const stats: ScriptStats = usageStats;

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting script stats:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
}