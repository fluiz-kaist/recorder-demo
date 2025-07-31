// pages/api/admin/uploadAuthorizedUsers.ts - Admin SDK로 변경
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin"; // Admin SDK 추가
import { FieldValue } from "firebase-admin/firestore"; // Admin SDK 추가
import { generateUserHash } from "@/utils/hash";
import formidable from "formidable";
import * as XLSX from "xlsx";
import fs from "fs";
import os from "os";

// 파일 업로드를 위한 설정
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ExcelRow {
  이름?: string;
  주민번호앞자리?: string;
  name?: string;
  socialNumber?: string;
  Name?: string;
  [key: string]: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "POST 방식만 지원합니다.",
    });
  }

  const regiUserCollectionName =
    process.env.NEXT_PUBLIC_DB_WHITELIST_USERS_COLLECTION || "whitelist-temp";

  try {
    // 1. 파일 업로드 처리 (OS별 임시 디렉토리 사용)
    const uploadDir = os.tmpdir(); // Windows: C:\Users\...\AppData\Local\Temp

    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB 제한
    });

    console.log("업로드 디렉토리:", uploadDir);

    const [fields, files] = await form.parse(req);
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "파일이 업로드되지 않았습니다.",
      });
    }

    console.log("업로드된 파일 경로:", uploadedFile.filepath);

    // 파일 존재 확인
    if (!fs.existsSync(uploadedFile.filepath)) {
      console.error("파일이 존재하지 않음:", uploadedFile.filepath);
      return res.status(400).json({
        success: false,
        message: "업로드된 파일을 찾을 수 없습니다.",
      });
    }

    // 2. 엑셀 파일 읽기
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

    console.log("엑셀 데이터 샘플:", jsonData.slice(0, 2));
    console.log("첫 번째 행 키들:", Object.keys(jsonData[0] || {}));

    if (jsonData.length === 0) {
      // 임시 파일 정리
      fs.unlinkSync(uploadedFile.filepath);
      return res.status(400).json({
        success: false,
        message: "엑셀 파일에 데이터가 없습니다.",
      });
    }

    // 3. 데이터 검증 및 변환
    const processedUsers = [];
    const errors = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // 엑셀 행 번호 (헤더 포함)

      try {
        // 필수 필드 확인 (여러 가능한 필드명 지원)
        const name = row["이름"] || row["name"] || row["Name"] || row["성명"];
        const socialNumber =
          row["주민번호앞자리"] ||
          row["주민번호"] ||
          row["socialNumber"] ||
          row["SocialNumber"];

        if (!name || !socialNumber) {
          errors.push(
            `${rowNum}행: 이름과 주민번호앞자리가 필요합니다. (찾은 필드: ${Object.keys(
              row
            ).join(", ")})`
          );
          continue;
        }

        // 데이터 정리
        const cleanName = String(name).trim();
        const cleanSocialNumber = String(socialNumber)
          .trim()
          .replace(/[^0-9]/g, ""); // 숫자만

        // 유효성 검증
        if (cleanName.length < 1) {
          // 최소 1자로 완화
          errors.push(`${rowNum}행: 이름이 비어있습니다. (${cleanName})`);
          continue;
        }

        if (cleanSocialNumber.length !== 6) {
          errors.push(
            `${rowNum}행: 주민번호앞자리는 6자리여야 합니다. (현재: ${cleanSocialNumber}, 길이: ${cleanSocialNumber.length})`
          );
          continue;
        }

        // 해시 생성
        const userHash = generateUserHash(cleanName, cleanSocialNumber);

        console.log(
          ">>>>",
          cleanName,
          "를 업로드할 때 생성하는 hash:",
          userHash
        );

        processedUsers.push({
          userHash,
          name: cleanName,
          socialNumber: cleanSocialNumber,
          createdAt: FieldValue.serverTimestamp(), // Admin SDK로 변경
          isActive: true,
          source: "excel_upload",
          rowNumber: rowNum,
        });
      } catch (error) {
        errors.push(
          `${rowNum}행: 처리 중 오류 - ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`
        );
      }
    }

    console.log(
      `처리 결과: ${processedUsers.length}개 성공, ${errors.length}개 오류`
    );

    // 4. 에러가 너무 많으면 중단
    if (errors.length > 0 && processedUsers.length === 0) {
      // 임시 파일 정리
      fs.unlinkSync(uploadedFile.filepath);
      return res.status(400).json({
        success: false,
        message: "처리 가능한 데이터가 없습니다.",
        errors: errors.slice(0, 10), // 처음 10개 오류만 표시
        totalErrors: errors.length,
      });
    }

    // 5. Firestore에 배치로 저장 (Admin SDK 방식)
    const batch = adminDb.batch(); // Admin SDK로 변경
    let savedCount = 0;

    for (const user of processedUsers) {
      try {
        const docRef = adminDb
          .collection(regiUserCollectionName)
          .doc(user.userHash); // Admin SDK로 변경

        batch.set(
          docRef,
          {
            userHash: user.userHash,
            name: user.name,
            adminName: "admin",
            createdAt: user.createdAt,
            isActive: user.isActive,
            source: user.source,
            uploadedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        savedCount++;

        // 배치 크기 제한 (450개씩)
        if (savedCount % 450 === 0) {
          await batch.commit();
          console.log(`${savedCount}개 저장 완료...`);
          // 새 배치 생성
          const newBatch = adminDb.batch(); // Admin SDK로 변경
          Object.assign(batch, newBatch);
        }
      } catch (error) {
        console.error(`해시 ${user.userHash} 저장 실패:`, error);
        errors.push(`${user.rowNumber}행: DB 저장 실패`);
      }
    }

    // 마지막 배치 커밋
    if (savedCount % 450 !== 0) {
      await batch.commit();
    }

    // 6. 임시 파일 정리
    try {
      fs.unlinkSync(uploadedFile.filepath);
      console.log("임시 파일 정리 완료");
    } catch (error) {
      console.warn("임시 파일 정리 실패:", error);
    }

    // 7. 결과 반환
    return res.status(200).json({
      success: true,
      message: "승인된 사용자 목록이 업로드되었습니다.",
      summary: {
        totalRows: jsonData.length,
        processed: processedUsers.length,
        saved: savedCount,
        errors: errors.length,
      },
      errors: errors.slice(0, 5), // 처음 5개 오류만 표시
      debugInfo: {
        uploadDir,
        firstRowKeys: Object.keys(jsonData[0] || {}),
        sampleData: processedUsers.slice(0, 2).map((u) => ({
          name: u.name,
          socialNumber: u.socialNumber,
          hash: u.userHash.substring(0, 8) + "...",
        })),
      },
    });
  } catch (error) {
    console.error("엑셀 업로드 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    });
  }
}

//주의사항: Admin SDK의 batch는 클라이언트 SDK와 사용법이 약간 다르므로, 배치 크기 제한 부분에서 새 배치 생성 로직을 확인해보시기 바랍니다.
